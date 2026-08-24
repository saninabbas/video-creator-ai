package com.aivideostudio.app.network.models

import com.google.gson.annotations.SerializedName

data class CreateVideoRequest(
    val topic: String,
    val videoType: String = "short", // "short" or "long"
    val durationSeconds: Int? = null,
    val durationMinutes: Int? = null,
    val style: String = "cinematic",
    val projectId: String? = null,
    val customInstructions: String? = null
)

data class CreateVideoResponse(
    val message: String,
    val jobId: String,
    val videoId: String,
    val status: String
)

data class VideoSceneDto(
    val id: String,
    @SerializedName("sceneNumber") val sceneNumber: Int,
    @SerializedName("durationSeconds") val durationSeconds: Float,
    val narration: String? = null,
    @SerializedName("visualPrompt") val visualPrompt: String,
    val status: String,
    @SerializedName("storageKey") val storageKey: String? = null
)

data class VideoDto(
    val id: String,
    @SerializedName("userId") val userId: String,
    @SerializedName("projectId") val projectId: String? = null,
    val type: String, // "short" or "long"
    val title: String,
    @SerializedName("durationSeconds") val durationSeconds: Float = 0f,
    val width: Int = 720,
    val height: Int = 1280,
    val status: String, // "queued" | "planning" | "generating" | "processing" | "completed" | "failed"
    @SerializedName("storageKey") val storageKey: String? = null,
    @SerializedName("thumbnailKey") val thumbnailKey: String? = null,
    @SerializedName("videoUrl") val videoUrl: String? = null,
    @SerializedName("thumbnailUrl") val thumbnailUrl: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    val scenes: List<VideoSceneDto>? = null
)

data class VideoListResponse(
    val videos: List<VideoDto>
)

data class VideoDetailResponse(
    val video: VideoDto
)

data class VideoJobStatusResponse(
    val id: String,
    val type: String,
    val title: String,
    val status: String, // "queued" | "planning" | "generating" | "processing" | "completed" | "failed"
    val progress: Int,
    @SerializedName("currentStep") val currentStep: String? = null,
    @SerializedName("videoUrl") val videoUrl: String? = null,
    @SerializedName("thumbnailUrl") val thumbnailUrl: String? = null,
    val scenes: List<VideoSceneDto>? = null,
    val error: String? = null
)

data class VideoImprovementsResponse(
    val message: String,
    val improvements: List<String>
)

data class ExtractShortsResponse(
    val message: String,
    val moments: List<ShortMomentDto>
)

data class ShortMomentDto(
    val title: String,
    val hook: String,
    val visualPrompt: String,
    val estimatedDurationSeconds: Int
)
