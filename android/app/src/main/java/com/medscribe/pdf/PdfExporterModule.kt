package com.medscribe.pdf

import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.os.Environment
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.medscribe.specs.NativePdfExporterSpec
import java.io.File
import java.io.FileOutputStream
import org.json.JSONObject

const val PDF_EXPORTER_NAME = "PdfExporter"

/**
 * Renders a patient report to a PDF using the platform's own PdfDocument.
 *
 * Written in-app rather than pulled from a library on purpose: no maintained
 * React Native PDF *generator* currently supports the New Architecture, and an
 * abandoned dependency in the export path of a medical record is a liability.
 *
 * The module knows nothing about patient fields. It draws whatever labelled
 * blocks the JSON payload contains, in order, so adding a report field is a
 * JavaScript change only (see `reportDocument.js`).
 */
class PdfExporterModule(reactContext: ReactApplicationContext) :
  NativePdfExporterSpec(reactContext) {

  private companion object {
    // A4 at 72 dpi, the unit PdfDocument works in.
    const val PAGE_WIDTH = 595
    const val PAGE_HEIGHT = 842
    const val MARGIN = 44f
    const val FOOTER_HEIGHT = 56f
    const val LABEL_COLUMN = 150f

    const val REPORTS_DIR = "MedScribe"
  }

  private val contentWidth = PAGE_WIDTH - (MARGIN * 2)

  // ---------------------------------------------------------------- paints

  private val titlePaint = TextPaint().apply {
    isAntiAlias = true
    color = Color.parseColor("#111827")
    textSize = 22f
    isFakeBoldText = true
  }

  private val metaPaint = TextPaint().apply {
    isAntiAlias = true
    color = Color.parseColor("#6B7280")
    textSize = 10f
  }

  private val sectionPaint = TextPaint().apply {
    isAntiAlias = true
    color = Color.parseColor("#1F2937")
    textSize = 12f
    isFakeBoldText = true
  }

  private val labelPaint = TextPaint().apply {
    isAntiAlias = true
    color = Color.parseColor("#6B7280")
    textSize = 11f
  }

  private val valuePaint = TextPaint().apply {
    isAntiAlias = true
    color = Color.parseColor("#111827")
    textSize = 12f
  }

  private val rulePaint = Paint().apply {
    color = Color.parseColor("#D1D5DB")
    strokeWidth = 0.8f
  }

  private val footerPaint = TextPaint().apply {
    isAntiAlias = true
    color = Color.parseColor("#9CA3AF")
    textSize = 8f
  }

  // ---------------------------------------------------------------- layout

  /**
   * One drawable run of text. Pagination walks these, so a long address or a
   * twelve-item symptom list flows onto the next page instead of being clipped.
   */
  private class Block(
    val layout: StaticLayout,
    val x: Float,
    val spaceBefore: Float,
    val spaceAfter: Float,
    /** A heading must not be stranded at the foot of a page. */
    val keepWithNext: Boolean = false,
    val rowLabel: StaticLayout? = null,
  ) {
    val height: Float
      get() = layout.height.toFloat()
  }

  private fun layoutOf(text: String, paint: TextPaint, width: Float): StaticLayout =
    StaticLayout.Builder
      .obtain(text, 0, text.length, paint, width.toInt().coerceAtLeast(1))
      .setAlignment(Layout.Alignment.ALIGN_NORMAL)
      .setIncludePad(false)
      .build()

  private fun buildBlocks(document: JSONObject): List<Block> {
    val blocks = mutableListOf<Block>()

    blocks.add(
      Block(layoutOf(document.optString("title"), titlePaint, contentWidth), MARGIN, 0f, 6f)
    )

    val meta = buildString {
      append("Generated ").append(document.optString("generatedAt"))
      val created = document.optString("createdAt")
      if (created.isNotEmpty()) append("   •   First saved ").append(created)
      append("   •   Status: ").append(document.optString("status", "DRAFT"))
    }
    blocks.add(Block(layoutOf(meta, metaPaint, contentWidth), MARGIN, 0f, 18f))

    blocks.add(
      Block(
        layoutOf("PATIENT DETAILS", sectionPaint, contentWidth),
        MARGIN,
        0f,
        8f,
        keepWithNext = true,
      )
    )

    val patient = document.optJSONArray("patient")
    if (patient != null) {
      for (index in 0 until patient.length()) {
        val row = patient.getJSONObject(index)
        blocks.add(
          Block(
            layoutOf(row.optString("value"), valuePaint, contentWidth - LABEL_COLUMN),
            MARGIN + LABEL_COLUMN,
            0f,
            8f,
            rowLabel = layoutOf(row.optString("label"), labelPaint, LABEL_COLUMN - 8f),
          )
        )
      }
    }

    val sections = document.optJSONArray("sections")
    if (sections != null) {
      for (index in 0 until sections.length()) {
        val section = sections.getJSONObject(index)

        blocks.add(
          Block(
            layoutOf(section.optString("label").uppercase(), sectionPaint, contentWidth),
            MARGIN,
            14f,
            8f,
            keepWithNext = true,
          )
        )

        val items = section.optJSONArray("items")
        if (items != null) {
          for (item in 0 until items.length()) {
            blocks.add(
              Block(
                layoutOf("•  ${items.getString(item)}", valuePaint, contentWidth - 12f),
                MARGIN + 12f,
                0f,
                4f,
              )
            )
          }
        } else {
          blocks.add(
            Block(layoutOf(section.optString("value"), valuePaint, contentWidth), MARGIN, 0f, 4f)
          )
        }
      }
    }

    return blocks
  }

  /** Split the blocks into pages before drawing, so footers can say "of N". */
  private fun paginate(blocks: List<Block>): List<List<Block>> {
    val pages = mutableListOf<List<Block>>()
    var page = mutableListOf<Block>()
    var y = MARGIN
    val limit = PAGE_HEIGHT - FOOTER_HEIGHT

    for ((index, block) in blocks.withIndex()) {
      var needed = block.spaceBefore + block.height
      if (block.keepWithNext && index + 1 < blocks.size) {
        needed += blocks[index + 1].height
      }

      if (y + needed > limit && page.isNotEmpty()) {
        pages.add(page)
        page = mutableListOf()
        y = MARGIN
      }

      page.add(block)
      y += block.spaceBefore + block.height + block.spaceAfter
    }

    if (page.isNotEmpty()) {
      pages.add(page)
    }

    return pages
  }

  private fun drawPage(
    canvas: Canvas,
    blocks: List<Block>,
    pageNumber: Int,
    pageCount: Int,
    disclaimer: String,
  ) {
    var y = MARGIN

    for (block in blocks) {
      y += block.spaceBefore

      block.rowLabel?.let { label ->
        canvas.save()
        canvas.translate(MARGIN, y)
        label.draw(canvas)
        canvas.restore()
      }

      canvas.save()
      canvas.translate(block.x, y)
      block.layout.draw(canvas)
      canvas.restore()

      y += block.height + block.spaceAfter
    }

    val footerTop = PAGE_HEIGHT - FOOTER_HEIGHT
    canvas.drawLine(MARGIN, footerTop, PAGE_WIDTH - MARGIN, footerTop, rulePaint)

    val note = layoutOf(disclaimer, footerPaint, contentWidth - 60f)
    canvas.save()
    canvas.translate(MARGIN, footerTop + 8f)
    note.draw(canvas)
    canvas.restore()

    canvas.drawText(
      "Page $pageNumber of $pageCount",
      PAGE_WIDTH - MARGIN - 60f,
      footerTop + 16f,
      footerPaint,
    )
  }

  // --------------------------------------------------------------- exports

  override fun exportReport(documentJson: String, promise: Promise) {
    try {
      val document = JSONObject(documentJson)
      val pages = paginate(buildBlocks(document))
      val disclaimer = document.optString("disclaimer")

      val pdf = PdfDocument()
      try {
        pages.forEachIndexed { index, blocks ->
          val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, index + 1).create()
          val page = pdf.startPage(pageInfo)
          page.canvas.drawColor(Color.WHITE)
          drawPage(page.canvas, blocks, index + 1, pages.size, disclaimer)
          pdf.finishPage(page)
        }

        // App-scoped external storage: shareable through FileProvider and
        // readable over adb, with no runtime storage permission on any API level.
        val directory = File(
          reactApplicationContext.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS),
          REPORTS_DIR,
        )
        if (!directory.exists() && !directory.mkdirs()) {
          promise.reject("E_PDF_DIR", "Could not create the reports folder.")
          return
        }

        val fileName = document.optString("fileName").ifEmpty { "patient-report.pdf" }
        val file = File(directory, fileName)
        FileOutputStream(file).use { stream -> pdf.writeTo(stream) }

        promise.resolve(file.absolutePath)
      } finally {
        pdf.close()
      }
    } catch (error: Exception) {
      promise.reject("E_PDF_EXPORT", error.message, error)
    }
  }

  override fun shareReport(path: String, promise: Promise) {
    try {
      val file = File(path)
      if (!file.exists()) {
        promise.reject("E_PDF_MISSING", "The exported file no longer exists.")
        return
      }

      val context = reactApplicationContext
      val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.fileprovider",
        file,
      )

      val send = Intent(Intent.ACTION_SEND).apply {
        type = "application/pdf"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      val chooser = Intent.createChooser(send, "Share patient report")
      val activity = currentActivity
      if (activity != null) {
        activity.startActivity(chooser)
      } else {
        // No activity when the app is backgrounded mid-export; the chooser
        // still needs a task of its own in that case.
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
      }

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_PDF_SHARE", error.message, error)
    }
  }
}
