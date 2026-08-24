package com.aivideostudio.app.ui.screens.create

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.aivideostudio.app.network.models.CreateVideoResponse
import com.aivideostudio.app.ui.components.ErrorBanner
import com.aivideostudio.app.ui.components.PrimaryButton
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CreateShortUiState(
    val topic: String = "",
    val durationSeconds: Int = 30,
    val style: String = "cinematic",
    val isLoading: Boolean = false,
    val error: String? = null,
    val createdJob: CreateVideoResponse? = null
)

class CreateShortViewModel(
    private val videoRepository: VideoRepository = VideoRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(CreateShortUiState())
    val uiState = _uiState.asStateFlow()

    fun updateTopic(newTopic: String) {
        _uiState.value = _uiState.value.copy(topic = newTopic, error = null)
    }

    fun updateDuration(duration: Int) {
        _uiState.value = _uiState.value.copy(durationSeconds = duration)
    }

    fun updateStyle(style: String) {
        _uiState.value = _uiState.value.copy(style = style)
    }

    fun generateVideo() {
        val topic = _uiState.value.topic.trim()
        if (topic.length < 3) {
            _uiState.value = _uiState.value.copy(error = "Please enter an idea or topic for your Short.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val result = videoRepository.createVideo(
                topic = topic,
                videoType = "short",
                durationSeconds = _uiState.value.durationSeconds,
                style = _uiState.value.style
            )

            when (result) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, createdJob = result.data)
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
                is NetworkResult.NetworkFailure -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
                NetworkResult.Loading -> {}
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateShortScreen(
    onNavigateBack: () -> Unit,
    onNavigateToProgress: (jobId: String, videoId: String) -> Unit,
    viewModel: CreateShortViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()

    LaunchedEffect(state.createdJob) {
        state.createdJob?.let {
            onNavigateToProgress(it.jobId, it.videoId)
        }
    }

    Scaffold(
        containerColor = BackgroundDark,
        topBar = {
            TopAppBar(
                title = { Text("Create Short (9:16)", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            state.error?.let {
                ErrorBanner(message = it)
            }

            // Topic / Idea Input
            Text("1. What is your video about?", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            OutlinedTextField(
                value = state.topic,
                onValueChange = { viewModel.updateTopic(it) },
                placeholder = { Text("e.g. 5 incredible facts about space exploration", color = TextMuted) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(130.dp),
                shape = RoundedCornerShape(16.dp),
                maxLines = 5
            )

            // Duration selector
            Text("2. Duration", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                listOf(15, 30, 60, 90).forEach { sec ->
                    val isSelected = state.durationSeconds == sec
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.updateDuration(sec) },
                        label = { Text("${sec}s", fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PrimaryPurple,
                            selectedLabelColor = TextPrimary,
                            containerColor = SurfaceDark,
                            labelColor = TextSecondary
                        ),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Visual Style
            Text("3. Visual Style", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                listOf("cinematic", "realistic", "storytelling", "educational").forEach { styleName ->
                    val isSelected = state.style == styleName
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.updateStyle(styleName) },
                        label = { Text(styleName.replaceFirstChar { it.uppercase() }) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = SecondaryBlue,
                            selectedLabelColor = TextPrimary,
                            containerColor = SurfaceDark,
                            labelColor = TextSecondary
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            val creditCost = when {
                state.durationSeconds <= 20 -> 10
                state.durationSeconds <= 40 -> 20
                else -> 35
            }

            // Dominant Generate Button (Dynamic Credits: 10, 20, 35)
            PrimaryButton(
                text = "⚡ Generate Short ($creditCost Credits)",
                onClick = { viewModel.generateVideo() },
                isLoading = state.isLoading
            )

            Text(
                text = "Veo 3.1 & Gemini will automatically plan scenes, script narration, and render your video.",
                fontSize = 12.sp,
                color = TextMuted,
                modifier = Modifier.padding(horizontal = 4.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
