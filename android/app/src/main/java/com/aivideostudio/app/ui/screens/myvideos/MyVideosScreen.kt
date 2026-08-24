package com.aivideostudio.app.ui.screens.myvideos

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
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
import com.aivideostudio.app.data.VideoRepository
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.network.models.VideoDto
import com.aivideostudio.app.ui.components.GridVideoCard
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class MyVideosUiState(
    val videos: List<VideoDto> = emptyList(),
    val searchQuery: String = "",
    val selectedTab: Int = 0, // 0 = All, 1 = Shorts, 2 = Long, 3 = Generating
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

    fun updateSearch(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
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

    val filteredVideos = remember(state.videos, state.selectedTab, state.searchQuery) {
        val list = when (state.selectedTab) {
            1 -> state.videos.filter { it.type == "short" }
            2 -> state.videos.filter { it.type == "long" }
            3 -> state.videos.filter { it.status in listOf("generating", "planning", "processing", "queued", "retrying") }
            else -> state.videos
        }
        if (state.searchQuery.isBlank()) {
            list
        } else {
            list.filter { it.title.contains(state.searchQuery, ignoreCase = true) }
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
            // Search Input
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                OutlinedTextField(
                    value = state.searchQuery,
                    onValueChange = { viewModel.updateSearch(it) },
                    placeholder = { Text("Search videos...", color = TextMuted, fontSize = 14.sp) },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = "Search", tint = TextMuted)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceDark,
                        unfocusedContainerColor = SurfaceDark,
                        focusedBorderColor = ElectricViolet,
                        unfocusedBorderColor = BorderDark,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    singleLine = true
                )
            }

            // Clean Restrained Tab Row
            TabRow(
                selectedTabIndex = state.selectedTab,
                containerColor = BackgroundDark,
                contentColor = ElectricViolet,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(tabPositions[state.selectedTab]),
                        color = ElectricViolet
                    )
                },
                divider = {
                    HorizontalDivider(color = BorderDark)
                }
            ) {
                listOf(
                    "All (${state.videos.size})",
                    "Shorts (${state.videos.count { it.type == "short" }})",
                    "Long (${state.videos.count { it.type == "long" }})",
                    "Active (${state.videos.count { it.status != "completed" && it.status != "failed" }})"
                ).forEachIndexed { index, title ->
                    Tab(
                        selected = state.selectedTab == index,
                        onClick = { viewModel.selectTab(index) },
                        text = {
                            Text(
                                text = title,
                                fontSize = 12.sp,
                                fontWeight = if (state.selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                color = if (state.selectedTab == index) TextPrimary else TextSecondary
                            )
                        }
                    )
                }
            }

            if (state.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = ElectricViolet)
                }
            } else if (filteredVideos.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text("No videos found in this view.", color = TextMuted, fontSize = 14.sp)
                }
            } else {
                // 2-Column Grid (Netflix / Modern Creator library feel)
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredVideos) { video ->
                        GridVideoCard(
                            video = video,
                            onClick = { onNavigateToPlayer(video.id) }
                        )
                    }
                }
            }
        }
    }
}
