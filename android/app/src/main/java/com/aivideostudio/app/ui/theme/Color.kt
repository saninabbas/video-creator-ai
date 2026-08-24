package com.aivideostudio.app.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// Deep Charcoal Theme Colors (The content is the hero)
val BackgroundDark = Color(0xFF0B0C0F)
val SurfaceDark = Color(0xFF121419)
val ElevatedSurface = Color(0xFF181B21)
val BorderDark = Color(0xFF242832)

// Typography Palette
val TextPrimary = Color(0xFFF5F7FA)
val TextSecondary = Color(0xFF9299A6)
val TextMuted = Color(0xFF626977)

// Brand Accents
val ElectricViolet = Color(0xFF8B5CF6)
val SoftIndigo = Color(0xFF6366F1)
val EmeraldGreen = Color(0xFF22C55E)
val AmberWarning = Color(0xFFF59E0B)
val ErrorRed = Color(0xFFEF4444)

// Backwards compatibility aliases
val PrimaryPurple = ElectricViolet
val PrimaryPurpleLight = Color(0xFFA78BFA)
val SecondaryBlue = SoftIndigo
val AccentGreen = EmeraldGreen
val SurfaceVariantDark = ElevatedSurface

// Gradients (Hero & Primary Creation only)
val HeroGradient = Brush.linearGradient(
    colors = listOf(ElectricViolet, SoftIndigo)
)
val CardGlowBorder = Brush.linearGradient(
    colors = listOf(ElectricViolet.copy(alpha = 0.6f), SoftIndigo.copy(alpha = 0.2f))
)
