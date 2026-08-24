package com.aivideostudio.app.network.models

import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class UserDto(
    val id: String,
    val email: String,
    val name: String,
    val credits: Int = 0,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class AuthResponse(
    val message: String? = null,
    val user: UserDto,
    val token: String? = null
)

data class UserProfileResponse(
    val user: UserDto
)

data class SimpleMessageResponse(
    val message: String
)
