package com.aivideostudio.app.ui.navigation

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Login : Screen("login")
    object Register : Screen("register")
    object Home : Screen("home")
    object CreateShort : Screen("create_short")
    object CreateLong : Screen("create_long")
    object Progress : Screen("progress/{jobId}/{videoId}") {
        fun createRoute(jobId: String, videoId: String) = "progress/$jobId/$videoId"
    }
    object Player : Screen("player/{videoId}") {
        fun createRoute(videoId: String) = "player/$videoId"
    }
    object MyVideos : Screen("my_videos")
    object Settings : Screen("settings")
}
