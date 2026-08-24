package com.aivideostudio.app.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aivideostudio.app.AIStudioApp
import com.aivideostudio.app.data.AuthRepository
import com.aivideostudio.app.network.NetworkResult
import com.aivideostudio.app.ui.components.ErrorBanner
import com.aivideostudio.app.ui.components.PrimaryButton
import com.aivideostudio.app.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val successMessage: String? = null
)

class AuthViewModel(
    private val authRepository: AuthRepository = AuthRepository(sessionManager = AIStudioApp.instance.sessionManager)
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState = _uiState.asStateFlow()

    fun login(email: String, pass: String) {
        if (email.isBlank() || pass.isBlank()) {
            _uiState.value = AuthUiState(error = "Please enter both email and password.")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState(isLoading = true)
            when (val result = authRepository.login(email.trim(), pass)) {
                is NetworkResult.Success -> _uiState.value = AuthUiState(isSuccess = true)
                is NetworkResult.Error -> _uiState.value = AuthUiState(error = result.message)
                is NetworkResult.NetworkFailure -> _uiState.value = AuthUiState(error = result.message)
                NetworkResult.Loading -> {}
            }
        }
    }

    fun register(name: String, email: String, pass: String) {
        if (name.isBlank() || email.isBlank() || pass.length < 8) {
            _uiState.value = AuthUiState(error = "Name, email, and 8+ character password required.")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState(isLoading = true)
            when (val result = authRepository.register(name.trim(), email.trim(), pass)) {
                is NetworkResult.Success -> _uiState.value = AuthUiState(isSuccess = true)
                is NetworkResult.Error -> _uiState.value = AuthUiState(error = result.message)
                is NetworkResult.NetworkFailure -> _uiState.value = AuthUiState(error = result.message)
                NetworkResult.Loading -> {}
            }
        }
    }

    fun forgotPassword(email: String) {
        if (email.isBlank()) {
            _uiState.value = AuthUiState(error = "Please enter your email address.")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState(isLoading = true)
            when (val result = authRepository.forgotPassword(email.trim())) {
                is NetworkResult.Success -> _uiState.value = AuthUiState(isSuccess = true, successMessage = result.data)
                is NetworkResult.Error -> _uiState.value = AuthUiState(error = result.message)
                is NetworkResult.NetworkFailure -> _uiState.value = AuthUiState(error = result.message)
                NetworkResult.Loading -> {}
            }
        }
    }

    fun resetPassword(token: String, newPass: String, confirmPass: String) {
        if (newPass.length < 8) {
            _uiState.value = AuthUiState(error = "Password must be at least 8 characters long.")
            return
        }
        if (newPass != confirmPass) {
            _uiState.value = AuthUiState(error = "Passwords do not match.")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState(isLoading = true)
            when (val result = authRepository.resetPassword(token.trim(), newPass)) {
                is NetworkResult.Success -> _uiState.value = AuthUiState(isSuccess = true, successMessage = result.data)
                is NetworkResult.Error -> _uiState.value = AuthUiState(error = result.message)
                is NetworkResult.NetworkFailure -> _uiState.value = AuthUiState(error = result.message)
                NetworkResult.Loading -> {}
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

@Composable
fun LoginScreen(
    onNavigateToHome: () -> Unit,
    onNavigateToRegister: () -> Unit,
    onNavigateToForgotPassword: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) onNavigateToHome()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Welcome Back", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Log in to generate stunning AI videos", fontSize = 14.sp, color = TextSecondary)
        Spacer(modifier = Modifier.height(32.dp))

        state.error?.let {
            ErrorBanner(message = it)
            Spacer(modifier = Modifier.height(16.dp))
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it; viewModel.clearError() },
            label = { Text("Email Address") },
            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = TextSecondary) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it; viewModel.clearError() },
            label = { Text("Password") },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondary) },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Text(
                text = "Forgot password?",
                color = ElectricViolet,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clickable { onNavigateToForgotPassword() }
                    .padding(vertical = 4.dp)
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        PrimaryButton(
            text = "Log In",
            onClick = { viewModel.login(email, password) },
            isLoading = state.isLoading,
            useGradient = true
        )

        Spacer(modifier = Modifier.height(24.dp))
        Row {
            Text("Don't have an account? ", color = TextSecondary, fontSize = 14.sp)
            Text(
                text = "Sign Up (Get 50 Credits)",
                color = ElectricViolet,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier.clickable { onNavigateToRegister() }
            )
        }
    }
}

@Composable
fun RegisterScreen(
    onNavigateToHome: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) onNavigateToHome()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Create Account", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Get 50 free credits upon signup", fontSize = 14.sp, color = EmeraldGreen)
        Spacer(modifier = Modifier.height(32.dp))

        state.error?.let {
            ErrorBanner(message = it)
            Spacer(modifier = Modifier.height(16.dp))
        }

        OutlinedTextField(
            value = name,
            onValueChange = { name = it; viewModel.clearError() },
            label = { Text("Your Name or Channel") },
            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = TextSecondary) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it; viewModel.clearError() },
            label = { Text("Email Address") },
            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = TextSecondary) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it; viewModel.clearError() },
            label = { Text("Password (8+ characters)") },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondary) },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp)
        )
        Spacer(modifier = Modifier.height(28.dp))

        PrimaryButton(
            text = "Create Account",
            onClick = { viewModel.register(name, email, password) },
            isLoading = state.isLoading,
            useGradient = true
        )

        Spacer(modifier = Modifier.height(24.dp))
        Row {
            Text("Already have an account? ", color = TextSecondary, fontSize = 14.sp)
            Text(
                text = "Log In",
                color = ElectricViolet,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier.clickable { onNavigateToLogin() }
            )
        }
    }
}

@Composable
fun ForgotPasswordScreen(
    onNavigateBack: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    var email by remember { mutableStateOf("") }
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Forgot Password", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Enter your email address and we will send you a secure link to reset your password.",
            fontSize = 14.sp,
            color = TextSecondary,
            modifier = Modifier.padding(horizontal = 8.dp)
        )
        Spacer(modifier = Modifier.height(32.dp))

        state.error?.let {
            ErrorBanner(message = it)
            Spacer(modifier = Modifier.height(16.dp))
        }

        if (state.isSuccess) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = EmeraldGreen.copy(alpha = 0.15f),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = androidx.compose.ui.graphics.SolidColor(EmeraldGreen)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = state.successMessage ?: "Password reset link sent.",
                    color = EmeraldGreen,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(16.dp)
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            PrimaryButton(text = "Return to Log In", onClick = onNavigateBack, useGradient = true)
        } else {
            OutlinedTextField(
                value = email,
                onValueChange = { email = it; viewModel.clearError() },
                label = { Text("Email Address") },
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = TextSecondary) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))

            PrimaryButton(
                text = "Send Reset Link",
                onClick = { viewModel.forgotPassword(email) },
                isLoading = state.isLoading,
                useGradient = true
            )

            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = "Remember your password? Log in",
                color = ElectricViolet,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { onNavigateBack() }
            )
        }
    }
}

@Composable
fun ResetPasswordScreen(
    token: String,
    onNavigateToLogin: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Reset Password", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Create a new secure password for your account", fontSize = 14.sp, color = TextSecondary)
        Spacer(modifier = Modifier.height(32.dp))

        state.error?.let {
            ErrorBanner(message = it)
            Spacer(modifier = Modifier.height(16.dp))
        }

        if (state.isSuccess) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = EmeraldGreen.copy(alpha = 0.15f),
                border = CardDefaults.outlinedCardBorder().copy(
                    brush = androidx.compose.ui.graphics.SolidColor(EmeraldGreen)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = state.successMessage ?: "Password updated successfully.",
                    color = EmeraldGreen,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(16.dp)
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            PrimaryButton(text = "Log In", onClick = onNavigateToLogin, useGradient = true)
        } else {
            OutlinedTextField(
                value = newPassword,
                onValueChange = { newPassword = it; viewModel.clearError() },
                label = { Text("New Password (8+ chars)") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondary) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it; viewModel.clearError() },
                label = { Text("Confirm New Password") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondary) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))

            PrimaryButton(
                text = "Reset Password",
                onClick = { viewModel.resetPassword(token, newPassword, confirmPassword) },
                isLoading = state.isLoading,
                useGradient = true
            )
        }
    }
}
