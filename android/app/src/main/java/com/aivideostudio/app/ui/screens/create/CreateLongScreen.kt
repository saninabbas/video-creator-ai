package com.aivideostudio.app.ui.screens.create

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aivideostudio.app.AIStudioApp
import com.aivideostudio.app.data.AuthRepository
import com.aivideostudio.app.data.CreditRepository
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
    val userCredits: Int = 250,
    val isLoading: Boolean = false,
    val error: String? = null,
    val createdJob: CreateVideoResponse? = null
)

class CreateLongViewModel(
    private val videoRepository: VideoRepository = VideoRepository(),
    private val creditRepository: CreditRepository = CreditRepository(),
    private val authRepository: AuthRepository = AuthRepository(sessionManager = AIStudioApp.instance.sessionManager)
) : ViewModel() {
    private val _uiState = MutableStateFlow(CreateLongUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadCredits()
    }

    private fun loadCredits() {
        viewModelScope.launch {
            val user = authRepository.getCachedUser()
            var balance = user?.credits ?: 250
            when (val res = creditRepository.getCredits()) {
                is NetworkResult.Success -> balance = res.data.balance
                else -> {}
            }
            _uiState.value = _uiState.value.copy(userCredits = balance)
        }
    }

    fun updateTopic(newTopic: String) {
        _uiState.value = _uiState.value.copy(topic = newTopic, error = null)
    }

    fun updateDuration(minutes: Int) {
        _uiState.value = _uiState.value.copy(durationMinutes = minutes)
    }

    fun updateStyle(style: String) {
        _uiState.value = _uiState.value.copy(style = style)
    }

    fun generateVideo() {
        val topic = _uiState.value.topic.trim()
        if (topic.length < 3) {
            _uiState.value = _uiState.value.copy(error = "Please describe the documentary or story topic.")
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

    val creditCost = when (state.durationMinutes) {
        8 -> 50
        10 -> 55
        15 -> 65
        20 -> 75
        30 -> 90
        else -> 50
    }
    val balanceAfter = (state.userCredits - creditCost).coerceAtLeast(0)

    val styles = listOf(
        Triple("documentary", "◉", "Documentary"),
        Triple("cinematic", "🎬", "Cinematic"),
        Triple("storytelling", "📖", "Storytelling"),
        Triple("educational", "🎓", "Educational"),
        Triple("deep_dive", "🔬", "Deep Dive")
    )

    Scaffold(
        containerColor = BackgroundDark,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Create Long Video",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "What story do you want to tell?",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        },
        bottomBar = {
            Surface(
                color = SurfaceDark,
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = androidx.compose.ui.graphics.SolidColor(BorderDark)
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${state.durationMinutes} min · 16:9 Landscape",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                        Text(
                            text = "$creditCost credits",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = SoftIndigo
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "After generation",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                        Text(
                            text = "$balanceAfter credits",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextSecondary
                        )
                    }

                    PrimaryButton(
                        text = "GENERATE LONG VIDEO  →",
                        onClick = { viewModel.generateVideo() },
                        isLoading = state.isLoading,
                        containerColor = SoftIndigo
                    )
                }
            }
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

            Spacer(modifier = Modifier.height(4.dp))

            // Large Creative Workspace Topic Input
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "TOPIC / SCRIPT OUTLINE",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextMuted,
                    letterSpacing = 1.sp
                )
                OutlinedTextField(
                    value = state.topic,
                    onValueChange = { viewModel.updateTopic(it) },
                    placeholder = {
                        Text(
                            text = "The History of Ancient Megastructures...\nor paste your research thesis / chapter outline",
                            color = TextMuted,
                            fontSize = 15.sp,
                            lineHeight = 22.sp
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceDark,
                        unfocusedContainerColor = SurfaceDark,
                        focusedBorderColor = SoftIndigo,
                        unfocusedBorderColor = BorderDark,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    maxLines = 6
                )
            }

            // Duration Selector (8m, 10m, 15m, 20m, 30m)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "DURATION",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextMuted,
                    letterSpacing = 1.sp
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(8, 10, 15, 20, 30).forEach { min ->
                        val isSelected = state.durationMinutes == min
                        val cost = when (min) {
                            8 -> 50
                            10 -> 55
                            15 -> 65
                            20 -> 75
                            else -> 90
                        }

                        Surface(
                            onClick = { viewModel.updateDuration(min) },
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) ElevatedSurface else SurfaceDark,
                            border = CardDefaults.outlinedCardBorder().copy(
                                brush = if (isSelected) CardGlowBorder else androidx.compose.ui.graphics.SolidColor(BorderDark)
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .height(56.dp)
                        ) {
                            Column(
                                modifier = Modifier.fillMaxSize(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = "${min}m",
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) TextPrimary else TextSecondary
                                )
                                Text(
                                    text = "$cost cr",
                                    fontSize = 10.sp,
                                    color = if (isSelected) SoftIndigo else TextMuted
                                )
                            }
                        }
                    }
                }
            }

            // Style Selector (Horizontal Visual Cards)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "STYLE",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextMuted,
                    letterSpacing = 1.sp
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(styles) { (key, icon, label) ->
                        val isSelected = state.style == key
                        Surface(
                            onClick = { viewModel.updateStyle(key) },
                            shape = RoundedCornerShape(14.dp),
                            color = if (isSelected) ElevatedSurface else SurfaceDark,
                            border = CardDefaults.outlinedCardBorder().copy(
                                brush = if (isSelected) CardGlowBorder else androidx.compose.ui.graphics.SolidColor(BorderDark)
                            ),
                            modifier = Modifier
                                .width(110.dp)
                                .height(80.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = icon,
                                    fontSize = 22.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = label,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) TextPrimary else TextSecondary
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
