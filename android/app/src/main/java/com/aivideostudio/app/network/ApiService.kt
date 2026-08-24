package com.aivideostudio.app.network

import com.aivideostudio.app.network.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // Auth
    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<SimpleMessageResponse>

    @POST("api/auth/forgot-password")
    suspend fun forgotPassword(@Body body: Map<String, String>): Response<SimpleMessageResponse>

    @POST("api/auth/reset-password")
    suspend fun resetPassword(@Body body: Map<String, String>): Response<SimpleMessageResponse>

    @GET("api/auth/me")
    suspend fun getProfile(): Response<UserProfileResponse>

    // Projects
    @POST("api/projects")
    suspend fun createProject(@Body body: CreateProjectRequest): Response<ProjectDetailResponse>

    @GET("api/projects")
    suspend fun getProjects(): Response<ProjectListResponse>

    @GET("api/projects/{id}")
    suspend fun getProjectById(@Path("id") id: String): Response<ProjectDetailResponse>

    @DELETE("api/projects/{id}")
    suspend fun deleteProject(@Path("id") id: String): Response<SimpleMessageResponse>

    // Videos
    @POST("api/videos/create")
    suspend fun createVideo(@Body body: CreateVideoRequest): Response<CreateVideoResponse>

    @GET("api/videos")
    suspend fun getVideos(@Query("limit") limit: Int = 50): Response<VideoListResponse>

    @GET("api/videos/{id}")
    suspend fun getVideoById(@Path("id") id: String): Response<VideoDetailResponse>

    @GET("api/videos/{id}/status")
    suspend fun getVideoStatus(@Path("id") id: String): Response<VideoJobStatusResponse>

    @POST("api/videos/{id}/improve")
    suspend fun getImprovements(@Path("id") id: String): Response<VideoImprovementsResponse>

    @POST("api/videos/{id}/create-shorts")
    suspend fun createShortsFromLong(@Path("id") id: String, @Body body: Map<String, Int>): Response<ExtractShortsResponse>

    @DELETE("api/videos/{id}")
    suspend fun deleteVideo(@Path("id") id: String): Response<SimpleMessageResponse>

    // Credits
    @GET("api/credits")
    suspend fun getCredits(): Response<CreditsResponse>

    // Notifications
    @GET("api/notifications")
    suspend fun getNotifications(): Response<NotificationListResponse>

    @PATCH("api/notifications/{id}/read")
    suspend fun markNotificationAsRead(@Path("id") id: String): Response<SimpleMessageResponse>
}
