package com.aivideostudio.app

import android.app.Application
import com.aivideostudio.app.auth.SessionManager
import com.aivideostudio.app.network.ApiClient

class AIStudioApp : Application() {
    lateinit var sessionManager: SessionManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        sessionManager = SessionManager(this)
        ApiClient.initialize(sessionManager)
    }

    companion object {
        lateinit var instance: AIStudioApp
            private set
    }
}
