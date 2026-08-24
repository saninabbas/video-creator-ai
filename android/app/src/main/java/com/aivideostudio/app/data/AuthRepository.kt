package com.aivideostudio.app.data

import com.aivideostudio.app.auth.SessionManager
import com.aivideostudio.app.network.ApiClient
import com.aivideostudio.app.network.ApiService
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.network.models.*
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthRepository(
    private val apiService: ApiService = ApiClient.service,
    private val sessionManager: SessionManager
) {
    suspend fun register(name: String, email: String, password: String): NetworkResult<AuthResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.register(RegisterRequest(email = email, password = password, name = name))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                body.token?.let { sessionManager.saveToken(it) }
                sessionManager.saveUser(body.user)
                NetworkResult.Success(body)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun login(email: String, password: String): NetworkResult<AuthResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.login(LoginRequest(email = email, password = password))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                body.token?.let { sessionManager.saveToken(it) }
                sessionManager.saveUser(body.user)
                NetworkResult.Success(body)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun logout(): NetworkResult<Unit> = withContext(Dispatchers.IO) {
        try {
            apiService.logout()
        } catch (_: Exception) {}
        sessionManager.clearSession()
        NetworkResult.Success(Unit)
    }

    suspend fun getProfile(): NetworkResult<UserDto> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getProfile()
            if (response.isSuccessful && response.body() != null) {
                val user = response.body()!!.user
                sessionManager.saveUser(user)
                NetworkResult.Success(user)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    fun getCachedUser(): UserDto? = sessionManager.getUser()

    fun isLoggedIn(): Boolean = sessionManager.isLoggedIn()

    private fun parseError(errorJson: String?): NetworkResult.Error {
        if (errorJson.isNullOrBlank()) {
            return NetworkResult.Error("UNKNOWN_ERROR", "An unexpected error occurred.")
        }
        return try {
            val errObj = Gson().fromJson(errorJson, ApiErrorResponse::class.java)
            NetworkResult.Error(errObj.error.code, errObj.error.message)
        } catch (e: Exception) {
            NetworkResult.Error("API_ERROR", "Server response could not be processed.")
        }
    }
}
