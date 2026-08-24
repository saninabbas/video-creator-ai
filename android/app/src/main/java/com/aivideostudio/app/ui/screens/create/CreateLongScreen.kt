package com.aivideostudio.app.ui.screens.create

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
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

data class CreateLongUiState(
    val topic: String = "",
    val durationMinutes: Int = 8,
    val style: String = "documentary",
    val isLoading: Boolean = false,
    val error: String? = null,
    val createdJob: CreateVideoResponse? = null
)

class CreateLongViewModel(
    private val videoRepository: VideoRepository = VideoRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(CreateLongUiState())
    val uiState = _uiState.asStateFlow()

    fun updateTopic(newTopic: String) {
        _uiState.value = _uiState.value.copy(topic = newTopic, error = null)
    }

    fun updateDurationMinutes(mins: Int) {
        _uiState.value = _uiState.value.copy(durationMinutes = mins)
    }

    fun updateStyle(style: String) {
        _uiState.value = _uiState.value.copy(style = style)
    }

    fun generateLongVideo() {
        val topic = _uiState.value.topic.trim()
        if (topic.length < 3) {
            _uiState.value = _uiState.value.copy(error = "Please enter a documentary or YouTube video topic.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val result = videoRepository.createVideo(
                topic = topic,
                videoType = "long",
                durationMinutes = _uiState.value.durationMinutes,
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
fun CreateLongScreen(
    onNavigateBack: () -> Unit,
    onNavigateToProgress: (jobId: String, videoId: String) -> Unit,
    viewModel: CreateLongViewModel = viewModel()
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
                title = { Text("Create Long Video (16:9)", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary) },
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
            Text("1. Documentary Topic or Episode Idea", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            OutlinedTextField(
                value = state.topic,
                onValueChange = { viewModel.updateTopic(it) },
                placeholder = { Text("e.g. The Untold History of Ancient Megastructures", color = TextMuted) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(130.dp),
                shape = RoundedCornerShape(16.dp),
                maxLines = 5
            )

            // Duration Presets (8m, 10m, 15m, 20m, 30m)
            Text("2. Target Duration", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(8, 10, 15, 20, 30).forEach { mins ->
                    val isSelected = state.durationMinutes == mins
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.updateDurationMinutes(mins) },
                        label = { Text("${mins}m", fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = SecondaryBlue,
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
                listOf("documentary", "cinematic", "storytelling", "educational").forEach { styleName ->
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

            val creditCost = when (state.durationMinutes) {
                8 -> 50
                10 -> 55
                15 -> 65
                20 -> 75
                30 -> 90
                else -> 50
            }

            // Dominant Generate Button (Dynamic Credits: 50, 55, 65, 75, 90)
            PrimaryButton(
                text = "⚡ Generate Long Video ($creditCost Credits)",
                onClick = { viewModel.generateLongVideo() },
                isLoading = state.isLoading,
                containerColor = SecondaryBlue
            )

            Text(
                text = "Gemini will automatically structure chapters, narration arcs, and multi-scene Visual Bibles.",
                fontSize = 12.sp,
                color = TextMuted,
                modifier = Modifier.padding(horizontal = 4.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
