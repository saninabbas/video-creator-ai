package com.aivideostudio.app

import com.aivideostudio.app.auth.SessionManager
import com.aivideostudio.app.data.AuthRepository
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

class AuthRepositoryTest {
    private val apiService = mockk<ApiService>()
    private val sessionManager = mockk<SessionManager>(relaxed = true)
    private lateinit var repository: AuthRepository

    @Before
    fun setup() {
        repository = AuthRepository(apiService, sessionManager)
    }

    @Test
    fun register_success_saves_token_and_user() = runTest {
        val userDto = UserDto(id = "user_1", email = "test@example.com", name = "Test User", credits = 50)
        val authResponse = AuthResponse(message = "Success", user = userDto, token = "test_token_123")

        coEvery { apiService.register(any()) } returns Response.success(authResponse)

        val result = repository.register("Test User", "test@example.com", "password123")

        assertTrue(result is NetworkResult.Success)
        assertEquals("user_1", (result as NetworkResult.Success).data.user.id)
        verify { sessionManager.saveToken("test_token_123") }
        verify { sessionManager.saveUser(userDto) }
    }

    @Test
    fun login_success_saves_session() = runTest {
        val userDto = UserDto(id = "user_1", email = "test@example.com", name = "Test User", credits = 50)
        val authResponse = AuthResponse(message = "Success", user = userDto, token = "test_token_123")

        coEvery { apiService.login(any()) } returns Response.success(authResponse)

        val result = repository.login("test@example.com", "password123")

        assertTrue(result is NetworkResult.Success)
        verify { sessionManager.saveToken("test_token_123") }
    }

    @Test
    fun login_error_returns_error_result() = runTest {
        val errorJson = "{\"error\":{\"code\":\"INVALID_CREDENTIALS\",\"message\":\"Incorrect email or password.\"}}"
        coEvery { apiService.login(any()) } returns Response.error(401, errorJson.toResponseBody())

        val result = repository.login("test@example.com", "wrong")

        assertTrue(result is NetworkResult.Error)
        assertEquals("INVALID_CREDENTIALS", (result as NetworkResult.Error).code)
        assertEquals("Incorrect email or password.", result.message)
    }

    @Test
    fun logout_clears_session() = runTest {
        coEvery { apiService.logout() } returns Response.success(SimpleMessageResponse("Logged out"))

        val result = repository.logout()

        assertTrue(result is NetworkResult.Success)
        verify { sessionManager.clearSession() }
    }
}
