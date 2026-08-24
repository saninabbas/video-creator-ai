package com.aivideostudio.app.data

import com.aivideostudio.app.network.ApiClient
import com.aivideostudio.app.network.ApiService
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.network.models.*
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ProjectRepository(
    private val apiService: ApiService = ApiClient.service
) {
    suspend fun getProjects(): NetworkResult<List<ProjectDto>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getProjects()
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.projects)
            } else {
                NetworkResult.Error("FETCH_ERROR", "Failed to retrieve projects.")
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun createProject(title: String, type: String): NetworkResult<ProjectDto> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createProject(CreateProjectRequest(title, type))
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.project)
            } else {
                NetworkResult.Error("CREATE_ERROR", "Failed to create project.")
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }
}

class CreditRepository(
    private val apiService: ApiService = ApiClient.service
) {
    suspend fun getCredits(): NetworkResult<CreditsResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getCredits()
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error("CREDIT_ERROR", "Failed to fetch credit information.")
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }
}

class NotificationRepository(
    private val apiService: ApiService = ApiClient.service
) {
    suspend fun getNotifications(): NetworkResult<List<NotificationDto>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getNotifications()
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.notifications)
            } else {
                NetworkResult.Error("NOTIF_ERROR", "Failed to fetch notifications.")
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun markAsRead(id: String): NetworkResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.markNotificationAsRead(id)
            if (response.isSuccessful) {
                NetworkResult.Success(Unit)
            } else {
                NetworkResult.Error("NOTIF_ERROR", "Failed to update notification.")
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }
}
