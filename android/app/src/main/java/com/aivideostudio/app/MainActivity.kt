package com.aivideostudio.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.aivideostudio.app.ui.navigation.AppNavHost
import com.aivideostudio.app.ui.theme.AIVideoStudioTheme
import com.aivideostudio.app.ui.theme.BackgroundDark

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AIVideoStudioTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = BackgroundDark
                ) {
                    val navController = rememberNavController()
                    
                    androidx.compose.runtime.LaunchedEffect(Unit) {
                        val uri = intent?.data
                        if (uri != null && (uri.path?.contains("reset-password") == true || uri.host == "reset-password")) {
                            val token = uri.getQueryParameter("token")
                            if (!token.isNullOrBlank()) {
                                navController.navigate("reset_password/$token")
                            }
                        }
                    }

                    AppNavHost(navController = navController)
                }
            }
        }
    }
}
