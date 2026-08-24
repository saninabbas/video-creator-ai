package com.aivideostudio.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.aivideostudio.app.ui.screens.auth.LoginScreen
import com.aivideostudio.app.ui.screens.auth.RegisterScreen
import com.aivideostudio.app.ui.screens.create.CreateLongScreen
import com.aivideostudio.app.ui.screens.create.CreateShortScreen
import com.aivideostudio.app.ui.screens.home.HomeScreen
import com.aivideostudio.app.ui.screens.myvideos.MyVideosScreen
import com.aivideostudio.app.ui.screens.player.VideoPlayerScreen
import com.aivideostudio.app.ui.screens.progress.GenerationProgressScreen
import com.aivideostudio.app.ui.screens.settings.SettingsScreen
import com.aivideostudio.app.ui.screens.splash.SplashScreen

@Composable
fun AppNavHost(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Splash.route
    ) {
        // 1. Splash Screen
        composable(Screen.Splash.route) {
            SplashScreen(
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        // 2. Login Screen
        composable(Screen.Login.route) {
            LoginScreen(
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(Screen.Register.route)
                }
            )
        }

        // 3. Register Screen
        composable(Screen.Register.route) {
            RegisterScreen(
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Register.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Register.route) { inclusive = true }
                    }
                }
            )
        }

        // 4. Home Screen
        composable(Screen.Home.route) {
            HomeScreen(
                onNavigateToCreateShort = { navController.navigate(Screen.CreateShort.route) },
                onNavigateToCreateLong = { navController.navigate(Screen.CreateLong.route) },
                onNavigateToMyVideos = { navController.navigate(Screen.MyVideos.route) },
                onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                onNavigateToPlayer = { videoId -> navController.navigate(Screen.Player.createRoute(videoId)) }
            )
        }

        // 5. Create Short Screen
        composable(Screen.CreateShort.route) {
            CreateShortScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToProgress = { jobId, videoId ->
                    navController.navigate(Screen.Progress.createRoute(jobId, videoId)) {
                        popUpTo(Screen.CreateShort.route) { inclusive = true }
                    }
                }
            )
        }

        // 6. Create Long Video Screen
        composable(Screen.CreateLong.route) {
            CreateLongScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToProgress = { jobId, videoId ->
                    navController.navigate(Screen.Progress.createRoute(jobId, videoId)) {
                        popUpTo(Screen.CreateLong.route) { inclusive = true }
                    }
                }
            )
        }

        // 7. Generation Progress Screen
        composable(
            route = Screen.Progress.route,
            arguments = listOf(
                navArgument("jobId") { type = NavType.StringType },
                navArgument("videoId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val jobId = backStackEntry.arguments?.getString("jobId") ?: ""
            val videoId = backStackEntry.arguments?.getString("videoId") ?: ""
            GenerationProgressScreen(
                jobId = jobId,
                videoId = videoId,
                onNavigateToPlayer = { vId ->
                    navController.navigate(Screen.Player.createRoute(vId)) {
                        popUpTo(Screen.Progress.route) { inclusive = true }
                    }
                },
                onNavigateToHome = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Progress.route) { inclusive = true }
                    }
                }
            )
        }

        // 8. Video Player / Ready Screen
        composable(
            route = Screen.Player.route,
            arguments = listOf(navArgument("videoId") { type = NavType.StringType })
        ) { backStackEntry ->
            val videoId = backStackEntry.arguments?.getString("videoId") ?: ""
            VideoPlayerScreen(
                videoId = videoId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // 9. My Videos Screen
        composable(Screen.MyVideos.route) {
            MyVideosScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToPlayer = { videoId -> navController.navigate(Screen.Player.createRoute(videoId)) }
            )
        }

        // 10. Settings Screen
        composable(Screen.Settings.route) {
            SettingsScreen(
                onNavigateBack = { navController.popBackStack() },
                onLoggedOut = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        }
    }
}
