package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.dsbuilder.frontend.feature.auth.application.OAuthLoginResult
import com.dsbuilder.frontend.plugin.androidstudio.PluginServices
import com.dsbuilder.frontend.plugin.androidstudio.auth.LoginScreen
import com.dsbuilder.frontend.plugin.androidstudio.auth.LoginUiState
import com.sdds.compose.uikit.Button
import com.sdds.serv.styles.basicbutton.BasicButtonStyles
import com.sdds.serv.styles.basicbutton.style
import com.sdds.serv.theme.SddsServTheme
import kotlinx.coroutines.launch

/**
 * Корневой экран плагина: экран логина, пока нет активной сессии, иначе [MainScreen].
 * `feature-auth`'s `OAuthLoginUseCase`/`OAuthLogoutUseCase` — простые suspend-функции без
 * собственного состояния, поэтому [LoginUiState] здесь держит сам экран, а не use case.
 *
 * Access token живёт только в памяти процесса, поэтому при каждом новом запуске IDE его нет —
 * но refresh token может быть жив в `PasswordSafe` с прошлого раза. Экран сначала молча пробует
 * восстановить сессию через него и только при неудаче показывает кнопку "Войти".
 */
@Composable
public fun PluginRootScreen(mainState: MainScreenState) {
    val scope = rememberCoroutineScope()
    var loginState by remember { mutableStateOf<LoginUiState>(LoginUiState.Idle) }
    var isLoggedIn by remember { mutableStateOf(PluginServices.sessionResolver.currentAccessToken() != null) }
    var isRestoringSession by remember {
        mutableStateOf(!isLoggedIn && PluginServices.sessionResolver.storedRefreshToken() != null)
    }

    LaunchedEffect(Unit) {
        if (isRestoringSession) {
            isLoggedIn = PluginServices.refreshUserSession.execute()
            isRestoringSession = false
        }
    }

    fun login() {
        scope.launch {
            loginState = LoginUiState.Loading
            when (val result = PluginServices.oauthLogin.execute()) {
                OAuthLoginResult.LoggedIn -> {
                    loginState = LoginUiState.Idle
                    isLoggedIn = true
                }
                is OAuthLoginResult.Failed -> loginState = LoginUiState.Error(result.message)
            }
        }
    }

    when {
        isRestoringSession ->
            LoginScreen(state = LoginUiState.Loading, onLoginClick = {})

        isLoggedIn ->
            Column(Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(
                            horizontal = SddsServTheme.spacing.spacing4x,
                            vertical = SddsServTheme.spacing.spacing2x,
                        ),
                    horizontalArrangement = Arrangement.End,
                ) {
                    Button(
                        label = "Выйти",
                        onClick = {
                            scope.launch {
                                PluginServices.oauthLogout.execute()
                                mainState.reset()
                                loginState = LoginUiState.Idle
                                isLoggedIn = false
                            }
                        },
                        style = BasicButtonStyles.BasicButtonSSecondary.style(),
                    )
                }
                MainScreen(
                    state = mainState,
                    listProjects = PluginServices::listProjects,
                    listDesignSystems = PluginServices.listDesignSystems,
                    listTenants = PluginServices::listTenants,
                    getTokenCodeReference = PluginServices::tokenCodeReference,
                    getDesignSystemTokens = PluginServices.getDesignSystemTokens,
                    onSessionExpired = {
                        mainState.reset()
                        isLoggedIn = false
                    },
                    modifier = Modifier.weight(1f),
                )
            }

        else ->
            LoginScreen(state = loginState, onLoginClick = ::login)
    }
}
