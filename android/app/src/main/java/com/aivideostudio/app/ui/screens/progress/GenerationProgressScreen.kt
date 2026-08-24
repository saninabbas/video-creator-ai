package com.aivideostudio.app.ui.screens.progress

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aivideostudio.app.data.VideoRepository
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.ui.components.PrimaryButton
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProgressUiState(
    val title: String = "Creating your video...",
    val progress: Int = 10,
    val currentStep: String = "Planning blueprint...",
    val status: String = "queued",
    val error: String? = null,
    val isCompleted: Boolean = false
)

class GenerationProgressViewModel(
    private val videoRepository: VideoRepository = VideoRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProgressUiState())
    val uiState = _uiState.asStateFlow()

    private var isPolling = true

    fun startPolling(videoId: String) {
        isPolling = true
        viewModelScope.launch {
            while (isPolling) {
                when (val result = videoRepository.getVideoStatus(videoId)) {
                    is NetworkResult.Success -> {
                        val data = result.data
                        _uiState.value = ProgressUiState(
                            title = data.title,
                            progress = data.progress,
                            currentStep = data.currentStep ?: "Creating video...",
                            status = data.status,
                            error = data.error,
                            isCompleted = data.status == "completed"
                        )

                        if (data.status == "completed" || data.status == "failed") {
                            isPolling = false
                        }
                    }
                    is NetworkResult.Error -> {}
                    is NetworkResult.NetworkFailure -> {}
                    NetworkResult.Loading -> {}
                }
                delay(3000)
            }
        }
    }

    fun stopPolling() {
        isPolling = false
    }

    override fun onCleared() {
        super.onCleared()
        stopPolling()
    }
}

@Composable
fun GenerationProgressScreen(
    jobId: String,
    videoId: String,
    onNavigateToPlayer: (String) -> Unit,
    onNavigateToHome: () -> Unit,
    viewModel: GenerationProgressViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(videoId) {
        viewModel.startPolling(videoId)
    }

    // Orb Animation
    val infiniteTransition = rememberInfiniteTransition(label = "orb")
    val scale by infiniteTransition.animateFloat(
        initialValue = 0.92f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.25f,
        targetValue = 0.65f,
        animationSpec = infiniteRepeatable(
            animation = tween(2400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glow"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Top Spacer
        Spacer(modifier = Modifier.height(20.dp))

        if (state.status == "failed") {
            // Failed State with Refund Message
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.ErrorOutline,
                    contentDescription = null,
                    tint = ErrorRed,
                    modifier = Modifier.size(64.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text("Creation Incomplete", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "We couldn't finish this generation. Your credits have been automatically refunded to your wallet.",
                    fontSize = 14.sp,
                    color = TextSecondary,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }
            PrimaryButton(text = "Return to Studio", onClick = onNavigateToHome)
        } else {
            // Active Progress State
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Animated Abstract AI Orb / Waveform
                Box(
                    modifier = Modifier
                        .size(130.dp)
                        .scale(scale),
                    contentAlignment = Alignment.Center
                ) {
                    // Outer glow
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(
                                Brush.radialGradient(
                                    listOf(
                                        ElectricViolet.copy(alpha = glowAlpha),
                                        SoftIndigo.copy(alpha = glowAlpha * 0.4f),
                                        Color.Transparent
                                    )
                                )
                            )
                    )
                    // Inner core
                    Box(
                        modifier = Modifier
                            .size(70.dp)
                            .clip(CircleShape)
                            .background(HeroGradient)
                    )
                }

                Spacer(modifier = Modifier.height(28.dp))

                Text(
                    text = "Creating your video",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = state.title,
                    fontSize = 14.sp,
                    color = TextSecondary,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Progress Checklist
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = SurfaceDark,
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(BorderDark)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        ProgressStepRow(title = "Planning your story", isDone = state.progress >= 25, isActive = state.progress in 1..24)
                        ProgressStepRow(title = "Writing scenes & prompts", isDone = state.progress >= 40, isActive = state.progress in 25..39)
                        ProgressStepRow(title = "Generating cinematic visuals", isDone = state.progress >= 70, isActive = state.progress in 40..69)
                        ProgressStepRow(title = "Creating natural narration", isDone = state.progress >= 85, isActive = state.progress in 70..84)
                        ProgressStepRow(title = "Assembling final video", isDone = state.progress >= 100, isActive = state.progress in 85..99)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Percentage & Remaining Time
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${state.progress}%",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = ElectricViolet
                    )
                    Text(
                        text = if (state.isCompleted) "Complete!" else "About 1 min remaining",
                        fontSize = 13.sp,
                        color = TextMuted
                    )
                }
            }

            // Bottom CTA
            if (state.isCompleted) {
                PrimaryButton(
                    text = "WATCH VIDEO  ▶",
                    onClick = { onNavigateToPlayer(videoId) },
                    useGradient = true
                )
            } else {
                Text(
                    text = "You can leave this screen — generation continues in background",
                    fontSize = 12.sp,
                    color = TextMuted,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))
    }
}

@Composable
private fun ProgressStepRow(
    title: String,
    isDone: Boolean,
    isActive: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(20.dp),
            contentAlignment = Alignment.Center
        ) {
            when {
                isDone -> {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        tint = EmeraldGreen,
                        modifier = Modifier.size(16.dp)
                    )
                }
                isActive -> {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(ElectricViolet)
                    )
                }
                else -> {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(TextMuted.copy(alpha = 0.4f))
                    )
                }
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Text(
            text = title,
            fontSize = 14.sp,
            fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal,
            color = if (isDone) TextPrimary else if (isActive) ElectricViolet else TextMuted
        )
    }
}
