package com.aivideostudio.app.ui.screens.splash

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aivideostudio.app.AIStudioApp
import com.aivideostudio.app.data.AuthRepository
import com.aivideostudio.app.ui.theme.BackgroundDark
import com.aivideostudio.app.ui.theme.PrimaryPurple
import com.aivideostudio.app.ui.theme.TextPrimary
import com.aivideostudio.app.ui.theme.TextSecondary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SplashViewModel(
    private val authRepository: AuthRepository = AuthRepository(sessionManager = AIStudioApp.instance.sessionManager)
) : ViewModel() {
    fun checkAuthStatus(onNavigateToHome: () -> Unit, onNavigateToLogin: () -> Unit) {
        viewModelScope.launch {
            delay(1000) // Brief brand presentation
            if (authRepository.isLoggedIn()) {
                onNavigateToHome()
            } else {
                onNavigateToLogin()
            }
        }
    }
}

@Composable
fun SplashScreen(
    onNavigateToHome: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: SplashViewModel = viewModel()
) {
    LaunchedEffect(Unit) {
        viewModel.checkAuthStatus(onNavigateToHome, onNavigateToLogin)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.AutoAwesome,
                contentDescription = null,
                tint = PrimaryPurple,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "AI Video Studio",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Idea to Video in Seconds",
                fontSize = 15.sp,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(32.dp))
            CircularProgressIndicator(
                color = PrimaryPurple,
                modifier = Modifier.size(28.dp),
                strokeWidth = 2.5.dp
            )
        }
    }
}
