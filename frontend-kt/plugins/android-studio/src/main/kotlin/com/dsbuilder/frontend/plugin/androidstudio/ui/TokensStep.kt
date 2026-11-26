package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import com.dsbuilder.frontend.feature.projects.application.Project
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenant
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceResult
import com.dsbuilder.frontend.plugin.androidstudio.tokens.DesignSystem
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GetDesignSystemTokensUseCase
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenMode
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenPlatform
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenWithValue
import com.sdds.compose.uikit.IconButton
import com.sdds.icons.compose.SddsIcons
import com.sdds.icons.compose.SleepOutline24
import com.sdds.icons.compose.SunOutline24
import com.sdds.serv.styles.basicbutton.style
import com.sdds.serv.styles.iconbutton.IconButtonStyles
import com.sdds.serv.styles.iconbutton.style

/**
 * Плагин работает только с Android: платформа не выбирается. Значения и code-ссылки токенов
 * запрашиваются для `android`.
 */
private val TOKENS_PLATFORM = TokenPlatform.ANDROID

@Composable
internal fun TokensStep(
    getDesignSystemTokens: GetDesignSystemTokensUseCase,
    project: Project,
    designSystem: DesignSystem,
    tenant: DesignSystemTenant,
    state: MainScreenState,
    getTokenCodeReference: suspend (projectId: String, designSystemId: String, tokenName: String, mode: String) ->
    TokenCodeReferenceResult,
    onSessionExpired: () -> Unit,
) {
    val mode = state.tokenMode
    var loadState by remember(project, designSystem, tenant, mode) {
        mutableStateOf<LoadState<List<TokenWithValue>>>(LoadState.Loading)
    }

    LaunchedEffect(project, designSystem, tenant, mode) {
        loadState = runCatchingLoad {
            getDesignSystemTokens.execute(project.id, designSystem.id, TOKENS_PLATFORM, mode, tenant.id)
        }
    }

    // Code-ссылка запрашивается по клику на конкретный токен (CodeBinding опубликованной документации).
    val resolveCodeReference: suspend (TokenWithValue) -> TokenCodeReferenceResult =
        { item -> getTokenCodeReference(project.id, designSystem.id, item.token.name, mode.name.lowercase()) }

    Column(Modifier.fillMaxSize()) {
        when (val current = loadState) {
            is LoadState.Loading -> LoadingText("Загружаем токены…")
            is LoadState.Failed ->
                ErrorText(current.message, onLoginClick = if (current.isSessionExpired) onSessionExpired else null)
            is LoadState.Loaded ->
                TokenList(
                    tokens = current.value,
                    selectedTabIndex = state.tokenTabIndex,
                    onTabSelected = { state.tokenTabIndex = it },
                    query = state.tokenQuery,
                    onQueryChange = { state.tokenQuery = it },
                    modifier = Modifier.weight(1f),
                    resolveCodeReference = resolveCodeReference,
                    modeToggle = { enabled -> ModeToggle(mode, { state.tokenMode = it }, enabled) },
                )
        }
    }
}

private fun TokenMode.label(): String = when (this) {
    TokenMode.LIGHT -> "Светлая"
    TokenMode.DARK -> "Тёмная"
}

/**
 * Кнопка режима темы: иконка показывает текущий режим (солнце — светлая, полумесяц — тёмная),
 * нажатие переключает на другой. Компактнее сегмента и не конкурирует
 * с сегментом типов токенов. Тултип по наведению называет режим и действие; на заблокированной
 * кнопке объясняет, почему она недоступна.
 */
@Composable
internal fun ModeToggle(mode: TokenMode, onModeChange: (TokenMode) -> Unit, enabled: Boolean) {
    val icon = when (mode) {
        TokenMode.LIGHT -> SddsIcons.SunOutline24
        TokenMode.DARK -> SddsIcons.SleepOutline24
    }
    val next = if (mode == TokenMode.LIGHT) TokenMode.DARK else TokenMode.LIGHT
    // hoverable на обёртке, а не на кнопке: у заблокированной кнопки hover может не доходить.
    val hoverSource = remember { MutableInteractionSource() }
    val isHovered by hoverSource.collectIsHoveredAsState()

    InlineTooltip(
        show = isHovered,
        text = if (enabled) {
            "${mode.label()} тема, переключить на ${next.label().lowercase()}"
        } else {
            "Режим темы влияет только на цвета и градиенты"
        },
        modifier = Modifier.hoverable(hoverSource),
    ) {
        IconButton(
            icon = rememberVectorPainter(icon),
            onClick = { onModeChange(next) },
            style = IconButtonStyles.IconButtonSSecondary.style(),
            enabled = enabled,
            iconContentDescription = "Режим темы: ${mode.label()}",
        )
    }
}
