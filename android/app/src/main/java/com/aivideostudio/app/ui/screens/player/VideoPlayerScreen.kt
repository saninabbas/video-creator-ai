package com.aivideostudio.app.ui.screens.player

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.aivideostudio.app.BuildConfig
import com.aivideostudio.app.data.VideoRepository
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.network.models.ShortMomentDto
import com.aivideostudio.app.network.models.VideoDto
import com.aivideostudio.app.ui.components.PrimaryButton
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PlayerUiState(
    val video: VideoDto? = null,
    val isLoading: Boolean = true,
    val error: String? = null,
    val improvements: List<String> = emptyList(),
    val extractedMoments: List<ShortMomentDto> = emptyList()
)

class VideoPlayerViewModel(
    private val videoRepository: VideoRepository = VideoRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState = _uiState.asStateFlow()

    fun loadVideo(videoId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            when (val res = videoRepository.getVideoById(videoId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(video = res.data, isLoading = false)
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(error = res.message, isLoading = false)
                }
                is NetworkResult.NetworkFailure -> {
                    _uiState.value = _uiState.value.copy(error = res.message, isLoading = false)
                }
                NetworkResult.Loading -> {}
            }
        }
    }

    fun requestImprovements(videoId: String) {
        viewModelScope.launch {
            when (val res = videoRepository.getImprovements(videoId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(improvements = res.data)
                }
                else -> {}
            }
        }
    }

    fun createShorts(videoId: String) {
        viewModelScope.launch {
            when (val res = videoRepository.createShortsFromLong(videoId, 3)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(extractedMoments = res.data)
                }
                else -> {}
            }
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
fun VideoPlayerScreen(
    videoId: String,
    onNavigateBack: () -> Unit,
    viewModel: VideoPlayerViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }

    LaunchedEffect(videoId) {
        viewModel.loadVideo(videoId)
    }

    // Initialize ExoPlayer when video URL is available
    val fullVideoUrl = remember(state.video?.videoUrl) {
        val path = state.video?.videoUrl ?: ""
        if (path.startsWith("http")) path else "${BuildConfig.BASE_URL.removeSuffix("/")}$path"
    }

    DisposableEffect(fullVideoUrl) {
        if (fullVideoUrl.isNotBlank()) {
            val player = ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(Uri.parse(fullVideoUrl)))
                prepare()
                playWhenReady = true
            }
            exoPlayer = player
        }
        onDispose {
            exoPlayer?.release()
            exoPlayer = null
        }
    }

    Scaffold(
        containerColor = BackgroundDark,
        topBar = {
            TopAppBar(
                title = { Text("Video Ready", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        }
    ) { padding ->
        if (state.isLoading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = PrimaryPurple)
            }
        } else {
            val video = state.video
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(scrollState)
            ) {
                // Video Player Container
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(if (video?.type == "short") 9f / 16f else 16f / 9f)
                        .background(SurfaceDark),
                    contentAlignment = Alignment.Center
                ) {
                    exoPlayer?.let { player ->
                        AndroidView(
                            factory = { ctx ->
                                PlayerView(ctx).apply {
                                    this.player = player
                                    layoutParams = FrameLayout.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                    useController = true
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }

                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = video?.title ?: "Untitled Video",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            text = if (video?.type == "short") "9:16 Short" else "16:9 Long Video",
                            fontSize = 13.sp,
                            color = TextSecondary
                        )
                        Text(text = "•", fontSize = 13.sp, color = TextMuted)
                        Text(
                            text = "${video?.durationSeconds?.toInt() ?: 0}s duration",
                            fontSize = 13.sp,
                            color = TextSecondary
                        )
                    }

                    // Action Buttons: Share & Download
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { shareVideoUrl(context, fullVideoUrl, video?.title) },
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Share")
                        }

                        OutlinedButton(
                            onClick = { downloadVideo(context, fullVideoUrl) },
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(18.dp), tint = TextPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Download", color = TextPrimary)
                        }
                    }

                    // For Long Videos: Extract Shorts option
                    if (video?.type == "long") {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Repurpose into Shorts", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("Extract high-impact vertical moments for TikTok & Reels.", fontSize = 13.sp, color = TextSecondary)
                                Spacer(modifier = Modifier.height(12.dp))
                                PrimaryButton(
                                    text = "✂️ Extract Shorts Moments",
                                    onClick = { viewModel.createShorts(videoId) },
                                    containerColor = SecondaryBlue
                                )
                            }
                        }
                    }

                    // Scene breakdown if available
                    video?.scenes?.let { scenes ->
                        if (scenes.isNotEmpty()) {
                            Text("Scenes Breakdown (${scenes.size} scenes)", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                            scenes.forEach { scene ->
                                Card(
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Text("Scene ${scene.sceneNumber} (${scene.durationSeconds.toInt()}s)", fontWeight = FontWeight.SemiBold, color = PrimaryPurpleLight, fontSize = 13.sp)
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(scene.visualPrompt, fontSize = 13.sp, color = TextSecondary)
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }
}

private fun shareVideoUrl(context: Context, url: String, title: String?) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, title ?: "AI Generated Video")
        putExtra(Intent.EXTRA_TEXT, "Watch my AI video: $url")
    }
    context.startActivity(Intent.createChooser(intent, "Share Video"))
}

private fun downloadVideo(context: Context, url: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
    context.startActivity(intent)
}
