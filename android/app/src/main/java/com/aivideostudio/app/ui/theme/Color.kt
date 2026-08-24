package com.aivideostudio.app.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// Linear / Runway Cinematic Theme Colors (#08090D, #101218, #151821)
val BackgroundDark = Color(0xFF08090D)
val SurfaceDark = Color(0xFF101218)
val ElevatedSurface = Color(0xFF151821)
val BorderDark = Color(0x14FFFFFF)

// Typography Palette
val TextPrimary = Color(0xFFF5F5F7)
val TextSecondary = Color(0xFF9A9CA6)
val TextMuted = Color(0xFF626977)

// Brand Accents
val ElectricViolet = Color(0xFF7C4DFF)
val SoftIndigo = Color(0xFF8B63FF)
val EmeraldGreen = Color(0xFF4ADE80)
val AmberWarning = Color(0xFFFBBF24)
val ErrorRed = Color(0xFFF87171)

// Backwards compatibility aliases
val PrimaryPurple = ElectricViolet
val PrimaryPurpleLight = SoftIndigo
val SecondaryBlue = SoftIndigo
val AccentGreen = EmeraldGreen
val SurfaceVariantDark = ElevatedSurface

// Subtle Gradients (Hero & Primary Creation only)
val HeroGradient = Brush.linearGradient(
    colors = listOf(ElectricViolet, SoftIndigo)
)
val CardGlowBorder = Brush.linearGradient(
    colors = listOf(ElectricViolet.copy(alpha = 0.4f), SoftIndigo.copy(alpha = 0.1f))
)
