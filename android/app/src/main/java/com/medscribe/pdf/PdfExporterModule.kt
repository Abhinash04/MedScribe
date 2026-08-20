package com.medscribe.pdf

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
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

class PdfExporterModule(reactContext: ReactApplicationContext) :
  NativePdfExporterSpec(reactContext) {

  private companion object {
    const val PAGE_WIDTH = 595
    const val PAGE_HEIGHT = 842
    const val MARGIN = 44f
    const val FOOTER_HEIGHT = 56f
    const val LABEL_COLUMN = 150f
    const val REPORTS_DIR = "MedScribe"
  }

  private val contentWidth = PAGE_WIDTH - (MARGIN * 2)

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

  private class Block(
    val layout: StaticLayout,
    val x: Float,
    val spaceBefore: Float,
    val spaceAfter: Float,
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

  private fun loadIpcLogo(): Bitmap? {
    try {
      val stream = reactApplicationContext.assets.open("ipc_logo.png")
      val bitmap = BitmapFactory.decodeStream(stream)
      stream.close()
      if (bitmap != null) return bitmap
    } catch (_: Exception) {}

    try {
      val resId = reactApplicationContext.resources.getIdentifier(
        "ipc_logo", "drawable", reactApplicationContext.packageName
      )
      if (resId != 0) {
        val bitmap = BitmapFactory.decodeResource(reactApplicationContext.resources, resId)
        if (bitmap != null) return bitmap
      }
    } catch (_: Exception) {}

    try {
      val paths = arrayOf(
        "D:/Downloads/MedScribe/docs/ipc_output/IPC_Report_Format_images/imageFile1.png",
        "D:/Downloads/MedScribe/src/assets/ipc_logo.png"
      )
      for (path in paths) {
        val file = File(path)
        if (file.exists()) {
          val bitmap = BitmapFactory.decodeFile(file.absolutePath)
          if (bitmap != null) return bitmap
        }
      }
    } catch (_: Exception) {}

    return null
  }

  private fun exportAdrReport(document: JSONObject, promise: Promise) {
    val pdf = PdfDocument()
    try {
      val pageInfo1 = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 1).create()
      val page1 = pdf.startPage(pageInfo1)
      page1.canvas.drawColor(Color.WHITE)
      drawAdrPage1(page1.canvas, document)
      pdf.finishPage(page1)

      val pageInfo2 = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 2).create()
      val page2 = pdf.startPage(pageInfo2)
      page2.canvas.drawColor(Color.WHITE)
      drawAdrPage2(page2.canvas)
      pdf.finishPage(page2)

      val directory = File(
        reactApplicationContext.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS),
        REPORTS_DIR,
      )
      if (!directory.exists() && !directory.mkdirs()) {
        promise.reject("E_PDF_DIR", "Could not create the reports folder.")
        return
      }

      val fileName = document.optString("fileName").ifEmpty { "adr-report.pdf" }
      val file = File(directory, fileName)
      FileOutputStream(file).use { stream -> pdf.writeTo(stream) }

      promise.resolve(file.absolutePath)
    } catch (error: Exception) {
      promise.reject("E_PDF_EXPORT", error.message, error)
    } finally {
      pdf.close()
    }
  }

  private fun drawCellHeader(
    canvas: Canvas,
    lines: Array<String>,
    leftX: Float,
    width: Float,
    topY: Float,
    cellHeight: Float,
    paint: TextPaint
  ) {
    val lineSpacing = paint.textSize * 1.05f
    val totalTextHeight = lines.size * lineSpacing
    val startY = topY + ((cellHeight - totalTextHeight) / 2f) + (paint.textSize * 0.8f)
    for ((idx, line) in lines.withIndex()) {
      val textW = paint.measureText(line)
      val drawX = (leftX + (width / 2f) - (textW / 2f)).coerceAtLeast(leftX + 1f)
      canvas.drawText(line, drawX, startY + (idx * lineSpacing), paint)
    }
  }

  private fun drawAdrPage1(canvas: Canvas, document: JSONObject) {
    val sectionA = document.optJSONObject("sectionA") ?: JSONObject()
    val sectionB = document.optJSONObject("sectionB") ?: JSONObject()

    val patientInitials = sectionA.optString("patientInitials")
    val ageOrDob = sectionA.optString("ageOrDob")
    val genderStr = sectionA.optString("gender").lowercase()
    val weightKg = sectionA.optString("weightKg")

    val reactionStartDate = sectionB.optString("reactionStartDate")
    val reactionStopDate = sectionB.optString("reactionStopDate")
    val rawDesc = sectionB.optString("description")
    
    val description = rawDesc.split(";").map { it.trim() }.filter { it.isNotEmpty() }.joinToString("; ")

    val titleP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 13.5f; isFakeBoldText = true }
    val subP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 8.5f }
    val subBoldP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 8.5f; isFakeBoldText = true }
    val verP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 9.5f; isFakeBoldText = true }
    val headerP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 8.5f; isFakeBoldText = true }
    val cellP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 8f }
    val cellBoldP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 8f; isFakeBoldText = true }
    
    // MANDATORY REQUIREMENT: ALL POPULATED PATIENT VALUES MUST BE PURE BLACK
    val valP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 8.5f; isFakeBoldText = true }

    val whiteP = TextPaint().apply { isAntiAlias = true; color = Color.WHITE; textSize = 9f; isFakeBoldText = true }
    val whiteSubP = TextPaint().apply { isAntiAlias = true; color = Color.WHITE; textSize = 7.5f }

    val borderP = Paint().apply { color = Color.BLACK; style = Paint.Style.STROKE; strokeWidth = 0.8f }
    val thickBorderP = Paint().apply { color = Color.BLACK; style = Paint.Style.STROKE; strokeWidth = 1.8f }
    val redFillP = Paint().apply { color = Color.parseColor("#CC0000"); style = Paint.Style.FILL }
    val lightBlueFillP = Paint().apply { color = Color.parseColor("#F4F8FF"); style = Paint.Style.FILL }
    val lightGrayFillP = Paint().apply { color = Color.parseColor("#F0F0F0"); style = Paint.Style.FILL }

    val tickP = Paint().apply {
      color = Color.BLACK
      style = Paint.Style.STROKE
      strokeWidth = 1.4f
      isAntiAlias = true
    }

    fun drawBlackCheckmark(left: Float, top: Float) {
      val path = Path()
      path.moveTo(left + 2.5f, top + 5.2f)
      path.lineTo(left + 4.5f, top + 7.8f)
      path.lineTo(left + 8.2f, top + 2.2f)
      canvas.drawPath(path, tickP)
    }

    // 1. Header (y: 20f to 80f)
    canvas.drawText("Version 1.4", 515f, 32f, verP)

    val logo = loadIpcLogo()
    if (logo != null) {
      // PRESERVE LOGO ASPECT RATIO WITHOUT STRETCHING
      val srcRatio = logo.width.toFloat() / logo.height.toFloat()
      val targetHeight = 55f
      val targetWidth = targetHeight * srcRatio
      canvas.drawBitmap(logo, null, RectF(20f, 20f, 20f + targetWidth, 20f + targetHeight), null)
    } else {
      canvas.drawRect(20f, 22f, 75f, 65f, borderP)
      canvas.drawText("IPC", 38f, 48f, headerP)
    }

    val cX = 297f
    fun drawCentered(text: String, y: Float, paint: TextPaint) {
      val w = paint.measureText(text)
      canvas.drawText(text, cX - (w / 2f), y, paint)
    }

    drawCentered("SUSPECTED ADVERSE DRUG REACTION REPORTING FORM", 32f, titleP)
    drawCentered("For VOLUNTARY reporting of ADRs by Healthcare Professionals", 44f, subP)
    drawCentered("INDIAN PHARMACOPOEIA COMMISSION (National Coordination Centre-Pharmacovigilance Programme of India)", 54f, subBoldP)
    drawCentered("Ministry of Health & Family Welfare, Government of India, Sector-23, Raj Nagar, Ghaziabad-201002", 64f, subP)
    drawCentered("PvPI Helpline (Toll Free) :1800-180-3024 (9:00 AM to 5:30 PM, Monday-Friday)", 74f, subBoldP)

    // 2. Top Double Column Box (y: 84f to 310f, height 226f)
    val topY = 84f
    val boxH = 226f
    val leftColW = 277f
    val rightColX = 297f
    val rightColW = 278f

    canvas.drawRect(20f, topY, 575f, topY + boxH, borderP)
    canvas.drawLine(rightColX, topY, rightColX, topY + boxH, borderP)

    val caseTypeStr = (sectionA.optString("caseType").ifEmpty { document.optString("caseType") }).lowercase()
    val isInitialCase = caseTypeStr.contains("initial") || caseTypeStr.contains("first") || caseTypeStr.contains("new")
    val isFollowUpCase = caseTypeStr.contains("follow")

    // Left Column Rows
    // Row 1 (Initial / Follow-up) y: 84f to 106f
    canvas.drawLine(20f, topY + 22f, rightColX, topY + 22f, borderP)
    canvas.drawLine(158f, topY, 158f, topY + 22f, borderP)
    canvas.drawText("Initial Case", 35f, topY + 15f, cellP)
    canvas.drawRect(95f, topY + 5f, 105f, topY + 15f, borderP)
    if (isInitialCase && !isFollowUpCase) drawBlackCheckmark(95f, topY + 5f)

    canvas.drawText("Follow-up Case", 170f, topY + 15f, cellP)
    canvas.drawRect(248f, topY + 5f, 258f, topY + 15f, borderP)
    if (isFollowUpCase && !isInitialCase) drawBlackCheckmark(248f, topY + 5f)

    // Section A Red Header (y: 106f to 124f)
    canvas.drawRect(20f, topY + 22f, rightColX, topY + 40f, redFillP)
    canvas.drawRect(20f, topY + 22f, rightColX, topY + 40f, borderP)
    canvas.drawText("A. PATIENT INFORMATION *", 24f, topY + 34f, whiteP)

    // Row 3 (1. Patient Initials & 2. Age or DOB) y: 124f to 146f
    canvas.drawLine(20f, topY + 62f, rightColX, topY + 62f, borderP)
    canvas.drawLine(158f, topY + 40f, 158f, topY + 62f, borderP)
    canvas.drawText("1. Patient Initials:", 24f, topY + 54f, cellP)
    
    valP.color = Color.BLACK
    if (patientInitials.isNotEmpty()) {
      canvas.drawText(patientInitials, 95f, topY + 54f, valP)
    }
    canvas.drawText("2. Age or date of birth:", 162f, topY + 54f, cellP)
    if (ageOrDob.isNotEmpty()) {
      canvas.drawText(ageOrDob, 248f, topY + 54f, valP)
    }

    // Row 4 (3. Gender & 4. Weight) y: 146f to 168f
    canvas.drawLine(20f, topY + 84f, rightColX, topY + 84f, borderP)
    canvas.drawLine(158f, topY + 62f, 158f, topY + 84f, borderP)
    canvas.drawText("3. Gender:", 24f, topY + 76f, cellP)

    val isMale = genderStr.contains("male") && !genderStr.contains("female")
    val isFemale = genderStr.contains("female")
    val isOther = genderStr.contains("other") || genderStr.contains("trans")

    canvas.drawText("M", 68f, topY + 76f, cellP)
    canvas.drawRect(78f, topY + 66f, 88f, topY + 76f, borderP)
    if (isMale) drawBlackCheckmark(78f, topY + 66f)

    canvas.drawText("F", 94f, topY + 76f, cellP)
    canvas.drawRect(102f, topY + 66f, 112f, topY + 76f, borderP)
    if (isFemale) drawBlackCheckmark(102f, topY + 66f)

    canvas.drawText("Other", 116f, topY + 76f, cellP)
    canvas.drawRect(142f, topY + 66f, 152f, topY + 76f, borderP)
    if (isOther) drawBlackCheckmark(142f, topY + 66f)

    canvas.drawText("4. Weight (in Kg.):", 162f, topY + 76f, cellP)
    if (weightKg.isNotEmpty()) {
      canvas.drawText(weightKg, 248f, topY + 76f, valP)
    }

    // Section B Red Header (y: 168f to 186f)
    canvas.drawRect(20f, topY + 84f, rightColX, topY + 102f, redFillP)
    canvas.drawRect(20f, topY + 84f, rightColX, topY + 102f, borderP)
    canvas.drawText("B. SUSPECTED ADVERSE REACTION *", 24f, topY + 96f, whiteP)

    // Row 6 (5. Event/Reaction start date) y: 186f to 206f
    canvas.drawLine(20f, topY + 122f, rightColX, topY + 122f, borderP)
    canvas.drawLine(205f, topY + 102f, 205f, topY + 122f, borderP)
    canvas.drawText("5. Event / Reaction start date (dd/mm/yyyy)", 24f, topY + 116f, cellP)
    if (reactionStartDate.isNotEmpty()) {
      canvas.drawText(reactionStartDate, 210f, topY + 116f, valP)
    }

    // Row 7 (6. Event/Reaction stop date) y: 206f to 226f
    canvas.drawLine(20f, topY + 142f, rightColX, topY + 142f, borderP)
    canvas.drawLine(205f, topY + 122f, 205f, topY + 142f, borderP)
    canvas.drawText("6. Event / Reaction stop date (dd/mm/yyyy)", 24f, topY + 136f, cellP)
    if (reactionStopDate.isNotEmpty()) {
      canvas.drawText(reactionStopDate, 210f, topY + 136f, valP)
    }

    // Row 8 (7. Describe Event/Reaction management...) y: 226f to 310f
    canvas.drawText("7. Describe Event/Reaction management with details, if any", 24f, topY + 154f, cellP)
    if (description.isNotEmpty()) {
      val layout = layoutOf(description, valP, leftColW - 12f)
      canvas.save()
      canvas.translate(24f, topY + 160f)
      layout.draw(canvas)
      canvas.restore()
    }

    // Right Column (FOR AMC / NCC USE ONLY)
    val rMidX = rightColX + (rightColW / 2f)
    val rW = headerP.measureText("FOR AMC / NCC USE ONLY")
    canvas.drawText("FOR AMC / NCC USE ONLY", rMidX - (rW / 2f), topY + 15f, headerP)
    canvas.drawLine(rightColX, topY + 22f, 575f, topY + 22f, borderP)

    canvas.drawText("Reg. No. / IPD No. / OPD No. / CR No. :", rightColX + 6f, topY + 34f, cellBoldP)
    canvas.drawLine(rightColX, topY + 40f, 575f, topY + 40f, borderP)

    canvas.drawText("AMC Report No.                          :", rightColX + 6f, topY + 52f, cellBoldP)
    canvas.drawLine(rightColX, topY + 58f, 575f, topY + 58f, borderP)

    canvas.drawText("Worldwide Unique No.                    :", rightColX + 6f, topY + 70f, cellBoldP)
    canvas.drawLine(rightColX, topY + 76f, 575f, topY + 76f, borderP)

    canvas.drawText("12. Relevant investigations with dates :", rightColX + 6f, topY + 88f, cellP)
    canvas.drawLine(rightColX, topY + 116f, 575f, topY + 116f, borderP)

    canvas.drawText("13. Relevant medical / medication history (e.g. allergies,", rightColX + 6f, topY + 128f, cellP)
    canvas.drawText("pregnancy, addiction, hepatic, renal dysfunction etc.)", rightColX + 6f, topY + 138f, cellP)
    canvas.drawLine(rightColX, topY + 161f, 575f, topY + 161f, borderP)

    canvas.drawText("14. Seriousness of the reaction : No [ ] if Yes [ ] (please tick anyone)", rightColX + 6f, topY + 172f, cellBoldP)
    canvas.drawText("[ ] Death (dd/mm/yyyy)         [ ] Congenital-anomaly", rightColX + 12f, topY + 183f, cellP)
    canvas.drawText("[ ] Life threatening                  [ ] Disability", rightColX + 12f, topY + 193f, cellP)
    canvas.drawText("[ ] Hospitalization-Initial/Prolonged [ ] Other Medically important", rightColX + 12f, topY + 203f, cellP)
    canvas.drawLine(rightColX, topY + 208f, 575f, topY + 208f, borderP)

    canvas.drawText("15. Outcome:", rightColX + 6f, topY + 217f, cellBoldP)
    canvas.drawText("[ ] Recovered     [ ] Recovering     [ ] Not Recovered", rightColX + 12f, topY + 225f, cellP)
    canvas.drawText("[ ] Fatal            [ ] Recovered with sequelae  [ ] Unknown", rightColX + 12f, topY + 225f + 10f, cellP)

    // 3. Section C (y: 314f to 600f, height 286f)
    var curY = 314f
    canvas.drawRect(20f, curY, 575f, curY + 18f, redFillP)
    canvas.drawRect(20f, curY, 575f, curY + 18f, borderP)
    canvas.drawText("C. SUSPECTED MEDICATION(S) *", 24f, curY + 13f, whiteP)
    curY += 18f

    // Table 1 (Suspected Medication Grid) height 103f
    val t1H = 103f
    canvas.drawRect(20f, curY, 575f, curY + t1H, borderP)
    canvas.drawLine(20f, curY + 30f, 575f, curY + 30f, borderP)
    
    // Column boundaries matching reference PDF layout
    val cXs = floatArrayOf(20f, 38f, 120f, 172f, 217f, 258f, 290f, 322f, 364f, 448f, 508f, 575f)
    for (i in 1 until cXs.size - 1) {
      canvas.drawLine(cXs[i], curY, cXs[i], curY + t1H, borderP)
    }
    canvas.drawLine(364f, curY + 15f, 448f, curY + 15f, borderP)
    canvas.drawLine(406f, curY + 15f, 406f, curY + t1H, borderP)

    val hdrP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 6.8f; isFakeBoldText = true }

    drawCellHeader(canvas, arrayOf("S.", "No."), 20f, 18f, curY, 30f, hdrP)
    drawCellHeader(canvas, arrayOf("8. Name", "(Brand/", "Generic)"), 38f, 82f, curY, 30f, hdrP)
    drawCellHeader(canvas, arrayOf("Manufacturer", "(if known)"), 120f, 52f, curY, 30f, hdrP)
    drawCellHeader(canvas, arrayOf("Batch No.", "/ Lot No."), 172f, 45f, curY, 30f, hdrP)
    drawCellHeader(canvas, arrayOf("Expiry Date", "(if known)"), 217f, 41f, curY, 30f, hdrP)
    drawCellHeader(canvas, arrayOf("Dose"), 258f, 32f, curY, 30f, hdrP)
    drawCellHeader(canvas, arrayOf("Route"), 290f, 32f, curY, 30f, hdrP)
    drawCellHeader(canvas, arrayOf("Frequency"), 322f, 42f, curY, 30f, hdrP)

    drawCellHeader(canvas, arrayOf("Therapy Dates"), 364f, 84f, curY, 15f, hdrP)
    drawCellHeader(canvas, arrayOf("Date Started"), 364f, 42f, curY + 15f, 15f, hdrP)
    drawCellHeader(canvas, arrayOf("Date Stopped"), 406f, 42f, curY + 15f, 15f, hdrP)

    drawCellHeader(canvas, arrayOf("Indication"), 448f, 60f, curY, 30f, hdrP)
    drawCellHeader(canvas, arrayOf("Causality", "Assessment"), 508f, 67f, curY, 30f, hdrP)

    val rH = (t1H - 30f) / 4f
    for (r in 0..3) {
      val rY = curY + 30f + (r * rH)
      if (r > 0) canvas.drawLine(20f, rY, 575f, rY, borderP)
      val label = when (r) { 0 -> "i"; 1 -> "ii"; 2 -> "iii"; else -> "iv#" }
      canvas.drawText(label, 24f, rY + 12f, cellP)
    }
    curY += t1H + 4f

    // Table 2 (Action taken #9 & Rechallenge #10) height 86f
    val t2H = 86f
    canvas.drawRect(20f, curY, 575f, curY + t2H, borderP)
    canvas.drawLine(335f, curY, 335f, curY + t2H, thickBorderP)
    canvas.drawRect(335f, curY, 575f, curY + t2H, thickBorderP)
    canvas.drawLine(20f, curY + 26f, 575f, curY + 26f, borderP)
    
    // Subheaders for Section 9
    val cXs9 = floatArrayOf(20f, 40f, 88f, 136f, 184f, 232f, 280f, 335f)
    for (i in 1 until cXs9.size - 1) {
      canvas.drawLine(cXs9[i], curY + 14f, cXs9[i], curY + t2H, borderP)
    }
    canvas.drawLine(20f, curY + 14f, 335f, curY + 14f, borderP)

    canvas.drawText("9. Action taken after reaction (please tick)", 24f, curY + 10f, cellBoldP)

    val hdrSmallP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 6.2f; isFakeBoldText = true }

    drawCellHeader(canvas, arrayOf("S.No"), 20f, 20f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Drug", "withdrawn"), 40f, 48f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Dose", "increased"), 88f, 48f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Dose", "reduced"), 136f, 48f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Dose not", "changed"), 184f, 48f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Not", "applicable"), 232f, 48f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Unknown"), 280f, 55f, curY + 14f, 12f, hdrSmallP)

    // Subheaders for Section 10
    val cXs10 = floatArrayOf(335f, 375f, 415f, 470f, 575f)
    for (i in 1 until cXs10.size - 1) {
      canvas.drawLine(cXs10[i], curY + 14f, cXs10[i], curY + t2H, borderP)
    }
    canvas.drawLine(335f, curY + 14f, 575f, curY + 14f, borderP)

    canvas.drawText("10. Reaction reappeared after reintroduction (please tick)", 339f, curY + 10f, cellBoldP)
    drawCellHeader(canvas, arrayOf("Yes"), 335f, 40f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("No"), 375f, 40f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Effect", "unknown"), 415f, 55f, curY + 14f, 12f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Dose", "(if re-introduced)"), 470f, 105f, curY + 14f, 12f, hdrSmallP)

    val r2H = (t2H - 26f) / 4f
    for (r in 0..3) {
      val rY = curY + 26f + (r * r2H)
      if (r > 0) canvas.drawLine(20f, rY, 575f, rY, borderP)
      val label = when (r) { 0 -> "i"; 1 -> "ii"; 2 -> "iii"; else -> "iv" }
      canvas.drawText(label, 24f, rY + 10f, cellP)
    }
    curY += t2H + 4f

    // Table 3 (Concomitant Medical Products #11) height 71f
    val t3H = 71f
    canvas.drawRect(20f, curY, 575f, curY + t3H, borderP)
    canvas.drawLine(20f, curY + 24f, 575f, curY + 24f, borderP)
    canvas.drawText("11. Concomitant medical product including self-medication and herbal remedies with therapy dates", 24f, curY + 10f, cellBoldP)
    canvas.drawText("(Exclude those used to treat reaction)", 24f, curY + 20f, cellP)

    val cXs11 = floatArrayOf(20f, 42f, 192f, 237f, 282f, 352f, 452f, 575f)
    for (i in 1 until cXs11.size - 1) {
      canvas.drawLine(cXs11[i], curY + 24f, cXs11[i], curY + t3H, borderP)
    }
    canvas.drawLine(352f, curY + 34f, 452f, curY + 34f, borderP)
    canvas.drawLine(402f, curY + 34f, 402f, curY + t3H, borderP)

    drawCellHeader(canvas, arrayOf("S. No."), 20f, 22f, curY + 24f, 21f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Name (Brand / Generic)"), 42f, 150f, curY + 24f, 21f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Dose"), 192f, 45f, curY + 24f, 21f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Route"), 237f, 45f, curY + 24f, 21f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Frequency", "(OD, BD, etc.)"), 282f, 70f, curY + 24f, 21f, hdrSmallP)
    
    drawCellHeader(canvas, arrayOf("Therapy Dates"), 352f, 100f, curY + 24f, 10f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Date Started"), 352f, 50f, curY + 34f, 11f, hdrSmallP)
    drawCellHeader(canvas, arrayOf("Date Stopped"), 402f, 50f, curY + 34f, 11f, hdrSmallP)

    drawCellHeader(canvas, arrayOf("Indication"), 452f, 123f, curY + 24f, 21f, hdrSmallP)

    val r3H = (t3H - 45f) / 3f
    for (r in 0..2) {
      val rY = curY + 45f + (r * r3H)
      if (r > 0) canvas.drawLine(20f, rY, 575f, rY, borderP)
      val label = when (r) { 0 -> "i"; 1 -> "ii"; else -> "iii#" }
      canvas.drawText(label, 24f, rY + 8f, cellP)
    }
    curY += t3H + 4f

    // 4. Bottom Box (Additional Info & Section D) (y: curY to curY + 156f)
    val bY = curY
    val bH = 156f
    canvas.drawRect(20f, bY, 575f, bY + bH, borderP)
    canvas.drawLine(345f, bY, 345f, bY + 108f, borderP)

    // Left Additional Info Fill Light Blue
    canvas.drawRect(20f, bY, 345f, bY + 108f, lightBlueFillP)
    canvas.drawRect(20f, bY, 345f, bY + 108f, borderP)
    canvas.drawText("Additional Information :", 24f, bY + 16f, cellBoldP)

    // Section D Red Header Row
    canvas.drawRect(345f, bY, 575f, bY + 18f, redFillP)
    canvas.drawRect(345f, bY, 575f, bY + 18f, borderP)
    canvas.drawText("D. REPORTER DETAILS *", 350f, bY + 13f, whiteP)

    // Section D Body Light Blue Fill
    canvas.drawRect(345f, bY + 18f, 575f, bY + 93f, lightBlueFillP)
    canvas.drawRect(345f, bY + 18f, 575f, bY + 93f, borderP)
    canvas.drawText("16. Name & Address : __________________________________", 350f, bY + 31f, cellP)
    canvas.drawText("_____________________________________________________", 350f, bY + 43f, cellP)
    canvas.drawText("Pin : ________ Email : ________________________________", 350f, bY + 55f, cellP)
    canvas.drawText("Contact No- : ________________  Occupation : ___________", 350f, bY + 67f, cellP)
    canvas.drawText("Signature : ___________________", 350f, bY + 79f, cellP)

    // Date of Report Footer of D
    canvas.drawRect(345f, bY + 93f, 575f, bY + 108f, lightBlueFillP)
    canvas.drawRect(345f, bY + 93f, 575f, bY + 108f, borderP)
    canvas.drawText("17. Date of this report (dd/mm/yyyy) :", 350f, bY + 104f, cellBoldP)

    // Receiving Personnel Row (y: bY + 108f to bY + 123f) Light Gray Fill
    canvas.drawRect(20f, bY + 108f, 575f, bY + 123f, lightGrayFillP)
    canvas.drawRect(20f, bY + 108f, 575f, bY + 123f, borderP)
    canvas.drawText("Signature and Name of Receiving Personnel : _____________________________________", 24f, bY + 119f, cellBoldP)

    // Red Confidentiality Banner (y: bY + 123f to bY + 156f) Red Fill
    canvas.drawRect(20f, bY + 123f, 575f, bY + 156f, redFillP)
    canvas.drawText("Confidentiality : The patient's identity is held in strict confidence and protected to the fullest extent. Submission of a report", 24f, bY + 135f, whiteSubP)
    canvas.drawText("does not constitute an admission that medical personnel or manufacturer caused the reaction. No legal implication on reporter.", 24f, bY + 147f, whiteSubP)

    curY += bH + 4f
    canvas.drawText("# Use separate page for more information", 20f, curY + 10f, subP)
    canvas.drawText("* Mandatory Fields for suspected ADR Reporting Form", 20f, curY + 20f, subP)
  }

  private fun drawAdrPage2(canvas: Canvas) {
    val blueTitleP = TextPaint().apply { isAntiAlias = true; color = Color.parseColor("#003399"); textSize = 11f; isFakeBoldText = true }
    val blueHeadP = TextPaint().apply { isAntiAlias = true; color = Color.parseColor("#003399"); textSize = 8.5f; isFakeBoldText = true }
    val bodyP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 7.5f }
    val bodyBoldP = TextPaint().apply { isAntiAlias = true; color = Color.BLACK; textSize = 7.5f; isFakeBoldText = true }
    val borderP = Paint().apply { color = Color.BLACK; style = Paint.Style.STROKE; strokeWidth = 0.8f }
    val lightBlueBgP = Paint().apply { color = Color.parseColor("#F4F8FF"); style = Paint.Style.FILL }
    val whiteBgP = Paint().apply { color = Color.WHITE; style = Paint.Style.FILL }

    val leftX = 15f
    val boxWidth = 567f
    val rightX = leftX + boxWidth // 582f

    // Main Advice Box (y: 9f to 522f)
    canvas.drawRect(leftX, 9f, rightX, 522f, lightBlueBgP)
    canvas.drawRect(leftX, 9f, rightX, 522f, borderP)

    // Title
    val titleW = blueTitleP.measureText("ADVICE ABOUT REPORTING")
    canvas.drawText("ADVICE ABOUT REPORTING", 297f - (titleW / 2f), 24f, blueTitleP)

    var y = 38f
    fun drawLineText(text: String, x: Float, isHeader: Boolean = false, isBoldBody: Boolean = false) {
      val p = if (isHeader) blueHeadP else if (isBoldBody) bodyBoldP else bodyP
      canvas.drawText(text, x, y, p)
      y += 9.5f
    }

    drawLineText("A. What to report?", 22f, isHeader = true)
    drawLineText("All adverse events should be reported", 28f)
    drawLineText("Report non-serious, known or unknown, frequent or rare adverse drug reactions due to Medicines, Vaccines & Herbal Products.", 28f)
    drawLineText("Report every serious adverse drug reactions. A reaction is serious when the patient outcome is :", 28f)
    drawLineText("• Death", 38f)
    drawLineText("• Life-threatening", 38f)
    drawLineText("• Hospitalization (initial or prolonged)", 38f)
    drawLineText("• Disability (significant, persistent or permanent)", 38f)
    drawLineText("• Congenital anomaly", 38f)
    drawLineText("• Report intervention to prevent permanent impairment or damage", 38f)
    drawLineText("NOTE : Serious/Adverse Event following immunization can also be reported in Serious AEFI case", 28f, isBoldBody = true)
    drawLineText("Notification Form available on http://www.ipc.gov.in", 28f, isBoldBody = true)
    y += 3f

    drawLineText("B. Who can report?", 22f, isHeader = true)
    drawLineText("All healthcare professionals (Clinicians, Dentists, Pharmacists and Nurse etc.) can report adverse drug reactions", 28f)
    y += 3f

    drawLineText("C. Where to report?", 22f, isHeader = true)
    drawLineText("Duly filled in Suspected Adverse Drug Reaction Reporting Form can be sent to the nearest Adverse Drug Reaction Monitoring Centre (AMC)", 28f)
    drawLineText("or directly to the National Coordination Centre (NCC) for PvPI.", 28f)
    drawLineText("Call on Helpline (Toll Free) 1800 180 3024 to report ADRs or directly mail this filled form to pvpi.ipc@gov.in", 28f)
    drawLineText("A list of nationwide AMCs is available at : http://www.ipc.gov.in, http://www.ipc.gov.in/PvPI/pv_home.html", 28f)
    y += 3f

    drawLineText("D. What happens to the submitted information?", 22f, isHeader = true)
    drawLineText("• Information provided in this form is handled in strict confidence. The causality assessment is carried out at AMCs by using WHO-UMC scale.", 28f)
    drawLineText("  The analyzed forms are forwarded to the NCC-PvPI through ADR database. Finally the data is analyzed and forwarded to the Global", 28f)
    drawLineText("  Pharmacovigilance Database managed by WHO Uppsala Monitoring Centre in Sweden.", 28f)
    drawLineText("• The reports are periodically reviewed by the NCC-PvPI. The information generated on the basis of these reports helps in continuous assessment", 28f)
    drawLineText("  of the benefit-risk ratio of medicines.", 28f)
    drawLineText("• The Signal Review Panel of PvPI reviews the data and suggests any interventions that may be required.", 28f)
    y += 3f

    drawLineText("E. Mandatory fields for suspected ADR Reporting Form (*)", 22f, isHeader = true)
    drawLineText("Patient initials, age at onset of reaction, reaction term(s), date of onset of reaction, suspected medication(s) & reporter information.", 28f)

    // Reporting Tools Box (y: 521f to 573f) - White Background
    canvas.drawRect(leftX, 521f, rightX, 573f, whiteBgP)
    canvas.drawRect(leftX, 521f, rightX, 573f, borderP)
    y = 533f
    drawLineText("For Adverse Drug Reaction Reporting Tools", 22f, isHeader = true)
    drawLineText("➢ E-mail : pvpi.ipc@gov.in", 28f)
    drawLineText("➢ PvPI Helpline (Toll Free) : 1800 180 3024 (9:00 AM to 5:30 PM, Monday-Friday)", 28f)
    drawLineText("➢ ADR Mobile App : \"ADRPvPI\"", 28f)
  }

  override fun exportReport(documentJson: String, promise: Promise) {
    try {
      val document = JSONObject(documentJson)
      if (document.optString("template") == "IPC_ADR_V1_4" || document.has("sectionA")) {
        exportAdrReport(document, promise)
        return
      }

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
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
      }

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_PDF_SHARE", error.message, error)
    }
  }
}
