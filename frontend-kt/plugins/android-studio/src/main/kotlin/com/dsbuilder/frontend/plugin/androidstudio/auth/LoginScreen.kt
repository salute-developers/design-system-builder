package com.dsbuilder.frontend.plugin.androidstudio.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import com.sdds.compose.uikit.Button
import com.sdds.serv.styles.basicbutton.BasicButtonStyles
import com.sdds.serv.styles.basicbutton.style
import com.sdds.serv.theme.SddsServTheme

/**
 * Экран логина плагина. Не содержит полей логина/пароля — только запускает браузерный
 * OAuth-флоу. Остаётся читаемым и прокручиваемым в узком/низком tool window.
 */
@Composable
public fun LoginScreen(
    state: LoginUiState,
    onLoginClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(SddsServTheme.spacing.spacing6x),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "DS Builder",
            color = SddsServTheme.colors.textDefaultPrimary,
            style = SddsServTheme.typography.displayMBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(SddsServTheme.spacing.spacing2x))
        Text(
            text = "Войдите, чтобы просматривать токены дизайн-системы",
            color = SddsServTheme.colors.textDefaultSecondary,
            style = SddsServTheme.typography.bodyMNormal,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(SddsServTheme.spacing.spacing6x))
        Button(
            label = "Войти в DS Builder",
            onClick = onLoginClick,
            style = BasicButtonStyles.BasicButtonLAccent.style(),
            enabled = state !is LoginUiState.Loading,
            loading = state is LoginUiState.Loading,
        )
        if (state is LoginUiState.Error) {
            Spacer(Modifier.height(SddsServTheme.spacing.spacing4x))
            Text(
                text = state.message,
                color = SddsServTheme.colors.textDefaultNegative,
                style = SddsServTheme.typography.bodyMNormal,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(SddsServTheme.spacing.spacing2x))
            Button(
                label = "Повторить",
                onClick = onLoginClick,
                style = BasicButtonStyles.BasicButtonLClear.style(),
            )
        }
    }
}
