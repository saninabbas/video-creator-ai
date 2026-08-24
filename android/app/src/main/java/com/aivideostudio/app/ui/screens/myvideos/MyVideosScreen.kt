package com.aivideostudio.app.ui.screens.myvideos

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.aivideostudio.app.network.models.VideoDto
import com.aivideostudio.app.ui.components.VideoCard
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class MyVideosUiState(
    val videos: List<VideoDto> = emptyList(),
    val selectedTab: Int = 0, // 0 = All, 1 = Shorts, 2 = Long
    val isLoading: Boolean = false,
    val error: String? = null
)

class MyVideosViewModel(
    private val videoRepository: VideoRepository = VideoRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(MyVideosUiState())
    val uiState = _uiState.asStateFlow()

    fun loadVideos() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            when (val res = videoRepository.getVideos(50)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(videos = res.data, isLoading = false)
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

    fun selectTab(tabIndex: Int) {
        _uiState.value = _uiState.value.copy(selectedTab = tabIndex)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyVideosScreen(
    onNavigateBack: () -> Unit,
    onNavigateToPlayer: (String) -> Unit,
    viewModel: MyVideosViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadVideos()
    }

    val filteredVideos = remember(state.videos, state.selectedTab) {
        when (state.selectedTab) {
            1 -> state.videos.filter { it.type == "short" }
            2 -> state.videos.filter { it.type == "long" }
            else -> state.videos
        }
    }

    Scaffold(
        containerColor = BackgroundDark,
        topBar = {
            TopAppBar(
                title = { Text("My Videos", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary) },
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
        ) {
            // Tab row
            TabRow(
                selectedTabIndex = state.selectedTab,
                containerColor = SurfaceDark,
                contentColor = PrimaryPurpleLight
            ) {
                Tab(
                    selected = state.selectedTab == 0,
                    onClick = { viewModel.selectTab(0) },
                    text = { Text("All (${state.videos.size})") }
                )
                Tab(
                    selected = state.selectedTab == 1,
                    onClick = { viewModel.selectTab(1) },
                    text = { Text("Shorts (${state.videos.count { it.type == "short" }})") }
                )
                Tab(
                    selected = state.selectedTab == 2,
                    onClick = { viewModel.selectTab(2) },
                    text = { Text("Long (${state.videos.count { it.type == "long" }})") }
                )
            }

            if (state.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryPurple)
                }
            } else if (filteredVideos.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text("No videos in this tab yet.", color = TextMuted, fontSize = 15.sp)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    items(filteredVideos) { video ->
                        VideoCard(
                            video = video,
                            onClick = { onNavigateToPlayer(video.id) }
                        )
                    }
                }
            }
        }
    }
}
