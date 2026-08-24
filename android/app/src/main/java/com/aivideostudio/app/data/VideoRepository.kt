package com.aivideostudio.app.data

import com.aivideostudio.app.network.ApiClient
import com.aivideostudio.app.network.ApiService
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.network.models.*
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class VideoRepository(
    private val apiService: ApiService = ApiClient.service
) {
    suspend fun createVideo(
        topic: String,
        videoType: String,
        durationSeconds: Int? = null,
        durationMinutes: Int? = null,
        style: String = "cinematic",
        projectId: String? = null,
        customInstructions: String? = null
    ): NetworkResult<CreateVideoResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createVideo(
                CreateVideoRequest(
                    topic = topic,
                    videoType = videoType,
                    durationSeconds = durationSeconds,
                    durationMinutes = durationMinutes,
                    style = style,
                    projectId = projectId,
                    customInstructions = customInstructions
                )
            )
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun getVideos(limit: Int = 50): NetworkResult<List<VideoDto>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getVideos(limit)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.videos)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun getVideoById(videoId: String): NetworkResult<VideoDto> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getVideoById(videoId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.video)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun getVideoStatus(videoId: String): NetworkResult<VideoJobStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getVideoStatus(videoId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun getImprovements(videoId: String): NetworkResult<List<String>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getImprovements(videoId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.improvements)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun createShortsFromLong(videoId: String, count: Int = 5): NetworkResult<List<ShortMomentDto>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createShortsFromLong(videoId, mapOf("count" to count))
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.moments)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    suspend fun deleteVideo(videoId: String): NetworkResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.deleteVideo(videoId)
            if (response.isSuccessful) {
                NetworkResult.Success(Unit)
            } else {
                parseError(response.errorBody()?.string())
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }

    private fun parseError(errorJson: String?): NetworkResult.Error {
        if (errorJson.isNullOrBlank()) {
            return NetworkResult.Error("UNKNOWN_ERROR", "An unexpected error occurred.")
        }
        return try {
            val errObj = Gson().fromJson(errorJson, ApiErrorResponse::class.java)
            val friendlyMsg = when (errObj.error.code) {
                "INSUFFICIENT_CREDITS" -> "You're out of credits. Please upgrade your plan."
                "GENERATION_FAILED" -> "We couldn't finish this video. Your credits have been refunded."
                else -> errObj.error.message
            }
            NetworkResult.Error(errObj.error.code, friendlyMsg)
        } catch (e: Exception) {
            NetworkResult.Error("API_ERROR", "Failed to communicate with server.")
        }
    }
}
