package com.aivideostudio.app.network.models

import com.google.gson.annotations.SerializedName

data class CreateProjectRequest(
    val title: String,
    val type: String // "short" or "long"
)

data class ProjectDto(
    val id: String,
    @SerializedName("userId") val userId: String,
    val title: String,
    val type: String,
    val status: String,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class ProjectListResponse(
    val projects: List<ProjectDto>
)

data class ProjectDetailResponse(
    val project: ProjectDto
)

// Credits
data class CreditTransactionDto(
    val id: String,
    val amount: Int,
    val type: String,
    val description: String,
    @SerializedName("balanceAfter") val balanceAfter: Int,
    @SerializedName("createdAt") val createdAt: String
)

data class CreditsResponse(
    val balance: Int,
    val transactions: List<CreditTransactionDto>
)

// Notifications
data class NotificationDto(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    @SerializedName("isRead") val isRead: Boolean,
    @SerializedName("createdAt") val createdAt: String
)

data class NotificationListResponse(
    val notifications: List<NotificationDto>
)

// Error
data class ErrorDetail(
    val code: String,
    val message: String
)

data class ApiErrorResponse(
    val error: ErrorDetail
)
