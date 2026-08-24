package com.aivideostudio.app.ui.screens.progress

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aivideostudio.app.data.VideoRepository
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.network.models.VideoJobStatusResponse
import com.aivideostudio.app.ui.components.PrimaryButton
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProgressUiState(
    val title: String = "Generating your video...",
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
                            currentStep = data.currentStep ?: "Processing video...",
                            status = data.status,
                            error = data.error,
                            isCompleted = data.status == "completed"
                        )

                        if (data.status == "completed" || data.status == "failed") {
                            isPolling = false
                        }
                    }
                    is NetworkResult.Error -> {
                        // Keep polling on transient errors
                    }
                    is NetworkResult.NetworkFailure -> {
                        // Keep polling on transient network hiccup
                    }
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (state.status == "failed") {
            // Failed State with Refund Message
            Icon(
                imageVector = Icons.Default.Error,
                contentDescription = null,
                tint = ErrorRed,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text("Creation Incomplete", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "We couldn't finish this generation. Your credits have been automatically refunded.",
                fontSize = 14.sp,
                color = TextSecondary,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
            Spacer(modifier = Modifier.height(32.dp))
            PrimaryButton(text = "Return to Home", onClick = onNavigateToHome)
        } else {
            // Active Progress State
            Text(
                text = state.title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                maxLines = 2
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = state.currentStep,
                fontSize = 15.sp,
                color = PrimaryPurpleLight,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(24.dp))

            // Percentage Bar
            LinearProgressIndicator(
                progress = { state.progress / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp),
                color = PrimaryPurple,
                trackColor = SurfaceVariantDark
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text("${state.progress}%", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)

            Spacer(modifier = Modifier.height(32.dp))

            // Stage Checkboxes
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    ProgressStepItem(title = "Planning video & script blueprint", isDone = state.progress >= 20, isCurrent = state.progress in 1..19)
                    ProgressStepItem(title = "Directing scenes with Veo 3.1", isDone = state.progress >= 70, isCurrent = state.progress in 20..69)
                    ProgressStepItem(title = "Synthesizing voiceover & audio", isDone = state.progress >= 85, isCurrent = state.progress in 70..84)
                    ProgressStepItem(title = "Assembling final master MP4", isDone = state.progress >= 100, isCurrent = state.progress in 85..99)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            if (state.isCompleted) {
                PrimaryButton(
                    text = "🎉 Watch Video Now",
                    onClick = { onNavigateToPlayer(videoId) },
                    containerColor = AccentGreen
                )
            } else {
                Text(
                    text = "You can leave this screen anytime. Your video will be in 'My Videos' when finished.",
                    fontSize = 12.sp,
                    color = TextMuted
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(
                    onClick = onNavigateToHome,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("Return to Dashboard", color = TextSecondary)
                }
            }
        }
    }
}

@Composable
fun ProgressStepItem(title: String, isDone: Boolean, isCurrent: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (isDone) {
            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = AccentGreen, modifier = Modifier.size(20.dp))
        } else if (isCurrent) {
            CircularProgressIndicator(color = PrimaryPurple, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
        } else {
            Icon(Icons.Default.RadioButtonUnchecked, contentDescription = null, tint = TextMuted, modifier = Modifier.size(20.dp))
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = title,
            fontSize = 14.sp,
            color = if (isDone || isCurrent) TextPrimary else TextMuted,
            fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}
