package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
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
 * "Есть сессия" пересчитывается при каждом изменении [PluginServices.loginController]
 * состояния — `applyTokens` в [com.dsbuilder.frontend.plugin.androidstudio.auth.LoginController]
 * выполняется синхронно до перехода состояния в `Idle`, так что порядок гарантирован.
 *
 * Access token живёт только в памяти процесса, поэтому при каждом новом запуске IDE его нет —
 * но refresh token может быть жив в `PasswordSafe` с прошлого раза. Экран сначала молча пробует
 * восстановить сессию через него и только при неудаче показывает кнопку "Войти".
 */
@Composable
public fun PluginRootScreen(isBrightIde: Boolean) {
    val scope = rememberCoroutineScope()
    val loginState by PluginServices.loginController.state.collectAsState()
    var isLoggedIn by remember { mutableStateOf(PluginServices.sessionResolver.currentAccessToken() != null) }
    var isRestoringSession by remember {
        mutableStateOf(!isLoggedIn && PluginServices.sessionResolver.storedRefreshToken() != null)
    }

    LaunchedEffect(Unit) {
        if (isRestoringSession) {
            isLoggedIn = PluginServices.sessionRefresher.refresh()
            isRestoringSession = false
        }
    }

    LaunchedEffect(loginState) {
        isLoggedIn = PluginServices.sessionResolver.currentAccessToken() != null
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
                                PluginServices.loginController.logout()
                                isLoggedIn = false
                            }
                        },
                        style = BasicButtonStyles.BasicButtonSSecondary.style(),
                    )
                }
                MainScreen(
                    listProjects = PluginServices.listProjects,
                    listDesignSystems = PluginServices.listDesignSystems,
                    getDesignSystemTokens = PluginServices.getDesignSystemTokens,
                    isBrightIde = isBrightIde,
                    onSessionExpired = { isLoggedIn = false },
                    modifier = Modifier.weight(1f),
                )
            }

        else ->
            LoginScreen(
                state = loginState,
                onLoginClick = { scope.launch { PluginServices.loginController.login() } },
            )
    }
}
