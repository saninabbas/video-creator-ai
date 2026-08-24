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
import androidx.compose.ui.graphics.Color
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
                title = { Text("Studio Preview", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary) },
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
                CircularProgressIndicator(color = ElectricViolet)
            }
        } else {
            val video = state.video
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(scrollState)
            ) {
                // Video Player Container (Deep Black Cinematic Frame)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(if (video?.type == "short") 0.65f else 1.77f)
                        .background(Color.Black),
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
                                    setBackgroundColor(android.graphics.Color.BLACK)
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
                    // Title
                    Text(
                        text = video?.title ?: "Untitled Video",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    // Metadata
                    val sec = video?.durationSeconds?.toInt() ?: 0
                    val durationStr = if (sec >= 60) "${sec / 60}m ${sec % 60}s" else "${sec}s"
                    val aspectStr = if (video?.type == "short") "9:16 Vertical" else "16:9 Landscape"
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "$durationStr  ·  $aspectStr  ·  Generated today",
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
                            onClick = { downloadVideoUrl(context, fullVideoUrl) },
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceDark)
                        ) {
                            Icon(Icons.Default.Download, contentDescription = "Download", tint = TextPrimary, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Download", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        }

                        Button(
                            onClick = { shareVideoUrl(context, fullVideoUrl, video?.title) },
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceDark)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = "Share", tint = TextPrimary, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Share", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        }
                    }

                    // Secondary CTA (e.g. Create Shorts from Long Video)
                    if (video?.type == "long") {
                        Spacer(modifier = Modifier.height(6.dp))
                        PrimaryButton(
                            text = "✦  Create Viral Shorts from This Video",
                            onClick = { video.id.let { viewModel.createShorts(it) } },
                            useGradient = true
                        )
                    }

                    // Extracted Viral Shorts section
                    if (state.extractedMoments.isNotEmpty()) {
                        Text(
                            text = "EXTRACTED VIRAL SHORTS",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextMuted,
                            letterSpacing = 1.sp
                        )
                        state.extractedMoments.forEach { moment ->
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = SurfaceDark,
                                border = CardDefaults.outlinedCardBorder().copy(
                                    brush = androidx.compose.ui.graphics.SolidColor(BorderDark)
                                ),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(moment.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                        Text(moment.hookReason, fontSize = 12.sp, color = TextSecondary)
                                    }
                                    Text("${moment.durationSeconds}s", fontSize = 12.sp, color = ElectricViolet, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}

private fun shareVideoUrl(context: Context, url: String, title: String?) {
    val sendIntent = Intent().apply {
        action = Intent.ACTION_SEND
        putExtra(Intent.EXTRA_TEXT, "Check out this video created with AI Video Studio: $url")
        putExtra(Intent.EXTRA_TITLE, title ?: "AI Video")
        type = "text/plain"
    }
    val shareIntent = Intent.createChooser(sendIntent, "Share AI Video")
    context.startActivity(shareIntent)
}

private fun downloadVideoUrl(context: Context, url: String) {
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        context.startActivity(intent)
    } catch (_: Exception) {}
}
