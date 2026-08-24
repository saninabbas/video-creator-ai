package com.aivideostudio.app.network

sealed class NetworkResult<out T> {
    data class Success<out T>(val data: T) : NetworkResult<T>()
    data class Error(val code: String, val message: String) : NetworkResult<Nothing>()
    data class NetworkFailure(val throwable: Throwable, val message: String = "Please check your internet connection and try again.") : NetworkResult<Nothing>()
    object Loading : NetworkResult<Nothing>()
}
