package com.medscribe.overlay

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin

data class SatelliteOffset(val x: Int, val y: Int)

object OverlayRadialGeometry {

  const val SPREAD_DEGREES = 55.0
  const val DIRECTION_RIGHT = 1
  const val DIRECTION_LEFT = -1

  private val FAN_OFFSETS = listOf(-SPREAD_DEGREES, 0.0, SPREAD_DEGREES)

  fun directionFor(anchorCentreX: Int, screenWidth: Int): Int =
    if (anchorCentreX > screenWidth / 2) DIRECTION_LEFT else DIRECTION_RIGHT

  fun verticalBiasDegrees(
    anchorCentreY: Int,
    screenHeight: Int,
    radius: Int,
    clearance: Int,
  ): Double {
    if (radius <= 0) {
      return 0.0
    }
    val topRoom = (clearance - anchorCentreY).toDouble() / radius
    val bottomRoom = (screenHeight - clearance - anchorCentreY).toDouble() / radius
    val lower =
      if (topRoom <= -1.0) {
        -SPREAD_DEGREES
      } else {
        SPREAD_DEGREES + degrees(asin(clampUnit(topRoom)))
      }
    val upper =
      if (bottomRoom >= 1.0) {
        SPREAD_DEGREES
      } else {
        -SPREAD_DEGREES + degrees(asin(clampUnit(bottomRoom)))
      }
    val bias = if (lower > upper) (lower + upper) / 2.0 else 0.0.coerceIn(lower, upper)
    return bias.coerceIn(-SPREAD_DEGREES, SPREAD_DEGREES)
  }

  fun offsets(
    anchorCentreX: Int,
    anchorCentreY: Int,
    screenWidth: Int,
    screenHeight: Int,
    radius: Int,
    clearance: Int,
  ): List<SatelliteOffset> {
    val direction = directionFor(anchorCentreX, screenWidth)
    val bias = verticalBiasDegrees(anchorCentreY, screenHeight, radius, clearance)
    val raw =
      FAN_OFFSETS.map { offset ->
        val angle = radians(bias + offset)
        SatelliteOffset(
          x = (direction * radius * cos(angle)).toInt(),
          y = (radius * sin(angle)).toInt(),
        )
      }

    val half = clearance / 2
    val minX = raw.minOf { anchorCentreX + it.x - half }
    val maxX = raw.maxOf { anchorCentreX + it.x + half }
    val minY = raw.minOf { anchorCentreY + it.y - half }
    val maxY = raw.maxOf { anchorCentreY + it.y + half }

    var shiftX = 0
    var shiftY = 0
    if (minX < 0) {
      shiftX = -minX
    } else if (maxX > screenWidth) {
      shiftX = screenWidth - maxX
    }
    if (minY < 0) {
      shiftY = -minY
    } else if (maxY > screenHeight) {
      shiftY = screenHeight - maxY
    }

    return raw.map { SatelliteOffset(it.x + shiftX, it.y + shiftY) }
  }

  private fun clampUnit(value: Double): Double = value.coerceIn(-1.0, 1.0)

  private fun degrees(value: Double): Double = value * 180.0 / Math.PI

  private fun radians(value: Double): Double = value * Math.PI / 180.0
}
