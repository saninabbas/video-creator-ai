package com.aivideostudio.app.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VideoLibrary
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
import com.aivideostudio.app.network.models.VideoDto
import com.aivideostudio.app.ui.components.CreditBadge
import com.aivideostudio.app.ui.components.VideoCard
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val userName: String = "Creator",
    val credits: Int = 0,
    val recentVideos: List<VideoDto> = emptyList(),
    val isLoading: Boolean = false
)

class HomeViewModel(
    private val authRepository: AuthRepository = AuthRepository(sessionManager = AIStudioApp.instance.sessionManager),
    private val videoRepository: VideoRepository = VideoRepository(),
    private val creditRepository: CreditRepository = CreditRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState = _uiState.asStateFlow()

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val user = authRepository.getCachedUser()
            val userName = user?.name ?: "Creator"

            // Fetch live credits
            var credits = user?.credits ?: 0
            when (val credRes = creditRepository.getCredits()) {
                is NetworkResult.Success -> credits = credRes.data.balance
                else -> {}
            }

            // Fetch recent videos
            var videos = emptyList<VideoDto>()
            when (val vidRes = videoRepository.getVideos(10)) {
                is NetworkResult.Success -> videos = vidRes.data
                else -> {}
            }

            _uiState.value = HomeUiState(
                userName = userName,
                credits = credits,
                recentVideos = videos,
                isLoading = false
            )
        }
    }
}

@Composable
fun HomeScreen(
    onNavigateToCreateShort: () -> Unit,
    onNavigateToCreateLong: () -> Unit,
    onNavigateToMyVideos: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToPlayer: (String) -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadData()
    }

    Scaffold(
        containerColor = BackgroundDark,
        bottomBar = {
            NavigationBar(containerColor = SurfaceDark) {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Default.Movie, contentDescription = "Home") },
                    label = { Text("Create") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToMyVideos,
                    icon = { Icon(Icons.Default.VideoLibrary, contentDescription = "My Videos") },
                    label = { Text("My Videos") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToSettings,
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") }
                )
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Hi, ${state.userName}",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "What do you want to create?",
                            fontSize = 14.sp,
                            color = TextSecondary
                        )
                    }
                    CreditBadge(credits = state.credits, onClick = onNavigateToSettings)
                }
            }

            // Quick Create Cards
            item {
                Text(
                    text = "AI Video Generators",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary
                )
            }

            item {
                // Short Video Card (Dominant)
                Card(
                    onClick = onNavigateToCreateShort,
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = PrimaryPurple.copy(alpha = 0.25f)),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(PrimaryPurple)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .padding(20.dp)
                            .fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = PrimaryPurple,
                                modifier = Modifier.padding(bottom = 6.dp)
                            ) {
                                Text(
                                    text = "9:16 VERTICAL",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            Text(
                                text = "Create Short / Reel",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "15s to 90s • TikTok, YouTube Shorts, Reels",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = PrimaryPurpleLight,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
            }

            item {
                // Long Video Card
                Card(
                    onClick = onNavigateToCreateLong,
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .padding(20.dp)
                            .fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = SecondaryBlue,
                                modifier = Modifier.padding(bottom = 6.dp)
                            ) {
                                Text(
                                    text = "16:9 WIDESCREEN",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            Text(
                                text = "Create Long Video",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "8 min to 30 min • Full YouTube Documentaries",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = SecondaryBlue,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
            }

            // Recent Videos
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Recent Videos",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                    if (state.recentVideos.isNotEmpty()) {
                        Text(
                            text = "See All",
                            fontSize = 14.sp,
                            color = PrimaryPurpleLight,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable { onNavigateToMyVideos() }
                        )
                    }
                }
            }

            if (state.recentVideos.isEmpty() && !state.isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No videos created yet. Tap above to make your first video!",
                            fontSize = 14.sp,
                            color = TextMuted
                        )
                    }
                }
            } else {
                items(state.recentVideos) { video ->
                    VideoCard(
                        video = video,
                        onClick = { onNavigateToPlayer(video.id) }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
