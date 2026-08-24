package com.aivideostudio.app.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
import com.aivideostudio.app.ui.components.CreditPackageCard
import com.aivideostudio.app.ui.components.VideoCard
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val userName: String = "Sanin",
    val credits: Int = 250,
    val recentVideos: List<VideoDto> = emptyList(),
    val isLoading: Boolean = false,
    val showCreditModal: Boolean = false
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

            var credits = user?.credits ?: 250
            when (val credRes = creditRepository.getCredits()) {
                is NetworkResult.Success -> credits = credRes.data.balance
                else -> {}
            }

            var videos = emptyList<VideoDto>()
            when (val vidRes = videoRepository.getVideos(10)) {
                is NetworkResult.Success -> videos = vidRes.data
                else -> {}
            }

            _uiState.value = _uiState.value.copy(
                userName = userName,
                credits = credits,
                recentVideos = videos,
                isLoading = false
            )
        }
    }

    fun showCreditModal(show: Boolean) {
        _uiState.value = _uiState.value.copy(showCreditModal = show)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
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

    // Credit Purchase Bottom Sheet
    if (state.showCreditModal) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.showCreditModal(false) },
            containerColor = SurfaceDark,
            dragHandle = { BottomSheetDefaults.DragHandle(color = TextMuted) }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 36.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Keep creating.",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Text(
                    text = "Choose a credit pack to fuel your video studio",
                    fontSize = 14.sp,
                    color = TextSecondary
                )

                Spacer(modifier = Modifier.height(4.dp))

                CreditPackageCard(
                    credits = 100,
                    priceUsd = "$10",
                    isPopular = false,
                    onClick = { viewModel.showCreditModal(false) }
                )
                CreditPackageCard(
                    credits = 250,
                    priceUsd = "$20",
                    isPopular = true,
                    onClick = { viewModel.showCreditModal(false) }
                )
                CreditPackageCard(
                    credits = 700,
                    priceUsd = "$50",
                    isPopular = false,
                    onClick = { viewModel.showCreditModal(false) }
                )
                CreditPackageCard(
                    credits = 1600,
                    priceUsd = "$100",
                    isPopular = false,
                    onClick = { viewModel.showCreditModal(false) }
                )
            }
        }
    }

    Scaffold(
        containerColor = BackgroundDark,
        bottomBar = {
            // 4-Destination Bottom Navigation
            NavigationBar(
                containerColor = SurfaceDark,
                tonalElevation = 0.dp
            ) {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Default.Home, contentDescription = "Home") },
                    label = { Text("Home", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = ElectricViolet,
                        selectedTextColor = ElectricViolet,
                        unselectedIconColor = TextMuted,
                        unselectedTextColor = TextMuted,
                        indicatorColor = SurfaceDark
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToCreateShort,
                    icon = {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(ElectricViolet.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("✦", color = ElectricViolet, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    },
                    label = { Text("Create", fontSize = 11.sp, color = TextSecondary) },
                    colors = NavigationBarItemDefaults.colors(
                        unselectedIconColor = TextPrimary,
                        unselectedTextColor = TextSecondary,
                        indicatorColor = SurfaceDark
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToMyVideos,
                    icon = { Icon(Icons.Default.VideoLibrary, contentDescription = "Videos") },
                    label = { Text("Videos", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        unselectedIconColor = TextMuted,
                        unselectedTextColor = TextMuted,
                        indicatorColor = SurfaceDark
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNavigateToSettings,
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                    label = { Text("Settings", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        unselectedIconColor = TextMuted,
                        unselectedTextColor = TextMuted,
                        indicatorColor = SurfaceDark
                    )
                )
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(10.dp))
                // Top App Bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Good morning, ${state.userName}",
                            fontSize = 14.sp,
                            color = TextSecondary
                        )
                        Text(
                            text = "Create something worth watching.",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                    }
                    CreditBadge(
                        credits = state.credits,
                        onClick = { viewModel.showCreditModal(true) }
                    )
                }
            }

            // Hero Headline
            item {
                Spacer(modifier = Modifier.height(6.dp))
                Column {
                    Text(
                        text = "Turn an idea into a video.",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        lineHeight = 34.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Create cinematic AI videos in minutes.",
                        fontSize = 14.sp,
                        color = TextSecondary
                    )
                }
            }

            // Hero Creation Card 1 — CREATE SHORT
            item {
                Card(
                    onClick = onNavigateToCreateShort,
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                    border = CardDefaults.outlinedCardBorder().copy(brush = CardGlowBorder),
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
                            Text(
                                text = "✦",
                                fontSize = 22.sp,
                                color = ElectricViolet
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Create Short",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Vertical  ·  9:16",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = ElectricViolet
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "15–60 seconds",
                                fontSize = 12.sp,
                                color = TextMuted
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.ArrowForward,
                            contentDescription = "Create Short",
                            tint = ElectricViolet,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }

            // Hero Creation Card 2 — CREATE LONG
            item {
                Card(
                    onClick = onNavigateToCreateLong,
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(BorderDark)
                    ),
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
                            Text(
                                text = "▣",
                                fontSize = 22.sp,
                                color = SoftIndigo
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Create Long",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Landscape  ·  16:9",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = SoftIndigo
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "8–30 minutes",
                                fontSize = 12.sp,
                                color = TextMuted
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.ArrowForward,
                            contentDescription = "Create Long",
                            tint = SoftIndigo,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }

            // Recent Videos Header
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "RECENT VIDEOS",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextMuted,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "View all →",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = ElectricViolet,
                        modifier = Modifier.clickable { onNavigateToMyVideos() }
                    )
                }
            }

            // Recent Videos List
            if (state.recentVideos.isEmpty()) {
                item {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = SurfaceDark,
                        border = CardDefaults.outlinedCardBorder().copy(
                            brush = androidx.compose.ui.graphics.SolidColor(BorderDark)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "No videos yet",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Choose a creation card above to craft your first AI video",
                                fontSize = 13.sp,
                                color = TextSecondary,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                items(state.recentVideos.take(3)) { video ->
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
