package com.aivideostudio.app

import com.aivideostudio.app.data.VideoRepository
import com.aivideostudio.app.network.ApiService
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.network.models.*
import io.mockk.*
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class VideoRepositoryTest {
    private val apiService = mockk<ApiService>()
    private lateinit var repository: VideoRepository

    @Before
    fun setup() {
        repository = VideoRepository(apiService)
    }

    @Test
    fun createVideo_short_success() = runTest {
        val createRes = CreateVideoResponse(
            message = "Video generation started.",
            jobId = "job_123",
            videoId = "vid_456",
            status = "queued"
        )
        coEvery { apiService.createVideo(any()) } returns Response.success(createRes)

        val result = repository.createVideo(
            topic = "5 facts about space",
            videoType = "short",
            durationSeconds = 30,
            style = "cinematic"
        )

        assertTrue(result is NetworkResult.Success)
        assertEquals("job_123", (result as NetworkResult.Success).data.jobId)
        assertEquals("vid_456", result.data.videoId)
        assertEquals("queued", result.data.status)
    }

    @Test
    fun createVideo_insufficient_credits_returns_friendly_error() = runTest {
        val errorJson = "{\"error\":{\"code\":\"INSUFFICIENT_CREDITS\",\"message\":\"Not enough credits\"}}"
        coEvery { apiService.createVideo(any()) } returns Response.error(402, errorJson.toResponseBody())

        val result = repository.createVideo(
            topic = "Long documentary",
            videoType = "long",
            durationMinutes = 8
        )

        assertTrue(result is NetworkResult.Error)
        assertEquals("INSUFFICIENT_CREDITS", (result as NetworkResult.Error).code)
        assertEquals("You're out of credits. Please upgrade your plan.", result.message)
    }

    @Test
    fun getVideoStatus_success() = runTest {
        val statusRes = VideoJobStatusResponse(
            id = "vid_456",
            type = "short",
            title = "5 facts about space",
            status = "generating",
            progress = 45,
            currentStep = "Rendering scene 2 of 4",
            videoUrl = null
        )
        coEvery { apiService.getVideoStatus("vid_456") } returns Response.success(statusRes)

        val result = repository.getVideoStatus("vid_456")

        assertTrue(result is NetworkResult.Success)
        val data = (result as NetworkResult.Success).data
        assertEquals("generating", data.status)
        assertEquals(45, data.progress)
        assertEquals("Rendering scene 2 of 4", data.currentStep)
    }

    @Test
    fun getVideos_list_success() = runTest {
        val videoList = listOf(
            VideoDto(id = "v1", userId = "u1", type = "short", title = "Video 1", status = "completed"),
            VideoDto(id = "v2", userId = "u1", type = "long", title = "Video 2", status = "generating")
        )
        coEvery { apiService.getVideos(any()) } returns Response.success(VideoListResponse(videoList))

        val result = repository.getVideos()

        assertTrue(result is NetworkResult.Success)
        assertEquals(2, (result as NetworkResult.Success).data.size)
    }
}
