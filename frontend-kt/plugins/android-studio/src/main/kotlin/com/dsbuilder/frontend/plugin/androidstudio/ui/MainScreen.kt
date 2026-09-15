package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.dsbuilder.frontend.plugin.androidstudio.api.SessionExpiredException
import com.dsbuilder.frontend.plugin.androidstudio.projects.ListProjectsUseCase
import com.dsbuilder.frontend.plugin.androidstudio.projects.Project
import com.dsbuilder.frontend.plugin.androidstudio.tokens.DesignSystem
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GetDesignSystemTokensUseCase
import com.dsbuilder.frontend.plugin.androidstudio.tokens.ListDesignSystemsUseCase
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenMode
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenPlatform
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenWithValue
import com.sdds.compose.uikit.Button
import com.sdds.compose.uikit.TabItem
import com.sdds.compose.uikit.Tabs
import com.sdds.serv.styles.basicbutton.BasicButtonStyles
import com.sdds.serv.styles.basicbutton.style
import com.sdds.serv.styles.tabitem.TabItemStyles
import com.sdds.serv.styles.tabitem.style
import com.sdds.serv.styles.tabs.TabsStyles
import com.sdds.serv.styles.tabs.style
import com.sdds.serv.theme.SddsServTheme

/**
 * Шаг просмотра: проект → дизайн-система → платформа → список токенов. Локальное состояние —
 * приложение маленькое, отдельный слой ViewModel/StateFlow на каждый шаг не оправдан.
 */
private sealed interface Step {
    data object PickProject : Step
    data class PickDesignSystem(val project: Project) : Step
    data class PickPlatform(val project: Project, val designSystem: DesignSystem) : Step
    data class ShowTokens(val project: Project, val designSystem: DesignSystem, val platform: TokenPlatform) : Step
}

private fun Step.label(): String = when (this) {
    is Step.PickProject -> "Проекты"
    is Step.PickDesignSystem -> project.name
    is Step.PickPlatform -> designSystem.name
    is Step.ShowTokens -> platform.name
}

private sealed interface LoadState<out T> {
    data object Loading : LoadState<Nothing>
    data class Loaded<T>(val value: T) : LoadState<T>
    data class Failed(val message: String, val isSessionExpired: Boolean = false) : LoadState<Nothing>
}

/**
 * Экран, который пользователь видит после успешного входа: read-only просмотр проектов,
 * дизайн-систем и токенов. Ничего не пишет в проект пользователя и не генерирует код.
 */
@Composable
public fun MainScreen(
    listProjects: ListProjectsUseCase,
    listDesignSystems: ListDesignSystemsUseCase,
    getDesignSystemTokens: GetDesignSystemTokensUseCase,
    isBrightIde: Boolean,
    onSessionExpired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var step by remember { mutableStateOf<Step>(Step.PickProject) }
    val history = remember { mutableStateListOf<Step>() }

    // Пропускаем шаг в историю (`replaceCurrent`), когда переход выбран автоматически —
    // единственный доступный вариант не должен оставлять в хлебных крошках шаг, который
    // пользователь на самом деле не выбирал (см. авто-переход при единственном проекте ниже).
    fun goTo(next: Step, replaceCurrent: Boolean = false) {
        if (!replaceCurrent) history.add(step)
        step = next
    }

    fun goToBreadcrumb(index: Int) {
        step = (history + step)[index]
        while (history.size > index) history.removeAt(history.lastIndex)
    }

    Column(modifier.fillMaxSize()) {
        if (history.isNotEmpty()) {
            Breadcrumbs(path = history + step, onSelect = ::goToBreadcrumb)
        }

        when (val currentStep = step) {
            is Step.PickProject ->
                ProjectStep(listProjects, onSessionExpired) { project, autoSelected ->
                    goTo(Step.PickDesignSystem(project), replaceCurrent = autoSelected)
                }

            is Step.PickDesignSystem ->
                DesignSystemStep(
                    listDesignSystems,
                    currentStep.project,
                    onSessionExpired,
                ) { designSystem, autoSelected ->
                    goTo(Step.PickPlatform(currentStep.project, designSystem), replaceCurrent = autoSelected)
                }

            is Step.PickPlatform ->
                PlatformStep { platform ->
                    goTo(Step.ShowTokens(currentStep.project, currentStep.designSystem, platform))
                }

            is Step.ShowTokens -> {
                // Тема IDE — только подсказка для стартового значения переключателя: у многих
                // студия всегда тёмная независимо от того, какую тему дизайн-системы им нужно
                // смотреть, поэтому режим должен переключаться явно, а не только автоматически.
                val initialMode = if (isBrightIde) TokenMode.LIGHT else TokenMode.DARK
                TokensStep(
                    getDesignSystemTokens,
                    currentStep.project,
                    currentStep.designSystem,
                    currentStep.platform,
                    initialMode,
                    onSessionExpired,
                )
            }
        }
    }
}

@Composable
private fun Breadcrumbs(path: List<Step>, onSelect: (Int) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = SddsServTheme.spacing.spacing4x, vertical = SddsServTheme.spacing.spacing2x),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        path.forEachIndexed { index, item ->
            val isLast = index == path.lastIndex
            if (isLast) {
                Text(
                    text = item.label(),
                    color = SddsServTheme.colors.textDefaultPrimary,
                    style = SddsServTheme.typography.bodySBold,
                )
            } else {
                BreadcrumbItem(label = item.label(), onClick = { onSelect(index) })
            }
            if (!isLast) {
                Text(
                    text = " / ",
                    color = SddsServTheme.colors.textDefaultSecondary,
                    style = SddsServTheme.typography.bodySNormal,
                )
            }
        }
    }
}

@Composable
private fun BreadcrumbItem(label: String, onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val isHovered by interactionSource.collectIsHoveredAsState()
    val isPressed by interactionSource.collectIsPressedAsState()
    val color = when {
        isPressed -> SddsServTheme.colors.textDefaultPrimaryActive
        isHovered -> SddsServTheme.colors.textDefaultPrimaryHover
        else -> SddsServTheme.colors.textDefaultPrimary
    }

    Text(
        text = label,
        color = color,
        style = SddsServTheme.typography.bodySNormal,
        // Без ripple/фона при ховере и клике — только смена цвета текста на hover/active токен.
        modifier = Modifier.clickable(interactionSource = interactionSource, indication = null, onClick = onClick),
    )
}

@Composable
private fun ProjectStep(
    listProjects: ListProjectsUseCase,
    onSessionExpired: () -> Unit,
    onSelect: (Project, autoSelected: Boolean) -> Unit,
) {
    var state by remember { mutableStateOf<LoadState<List<Project>>>(LoadState.Loading) }

    LaunchedEffect(Unit) {
        state = runCatchingLoad { listProjects.execute() }
    }

    val current = state
    if (current is LoadState.Loaded && current.value.size == 1) {
        // Единственный доступный проект не требует явного выбора — выбираем его сразу и не
        // засоряем хлебные крошки шагом без реальной альтернативы.
        LaunchedEffect(current.value) { onSelect(current.value.single(), true) }
    }

    when (current) {
        is LoadState.Loading -> LoadingText("Загружаем проекты…")
        is LoadState.Failed ->
            ErrorText(current.message, onLoginClick = if (current.isSessionExpired) onSessionExpired else null)
        is LoadState.Loaded -> when {
            current.value.isEmpty() -> EmptyProjectsState()
            current.value.size == 1 -> LoadingText("Загружаем проекты…")
            else -> PickerList(
                items = current.value,
                label = { it.name },
                sublabel = { it.description },
                onSelect = { onSelect(it, false) },
            )
        }
    }
}

@Composable
private fun DesignSystemStep(
    listDesignSystems: ListDesignSystemsUseCase,
    project: Project,
    onSessionExpired: () -> Unit,
    onSelect: (DesignSystem, autoSelected: Boolean) -> Unit,
) {
    var state by remember(project) { mutableStateOf<LoadState<List<DesignSystem>>>(LoadState.Loading) }

    LaunchedEffect(project) {
        state = runCatchingLoad { listDesignSystems.execute(project.id) }
    }

    val current = state
    if (current is LoadState.Loaded && current.value.size == 1) {
        LaunchedEffect(current.value) { onSelect(current.value.single(), true) }
    }

    when (current) {
        is LoadState.Loading -> LoadingText("Загружаем дизайн-системы…")
        is LoadState.Failed ->
            ErrorText(current.message, onLoginClick = if (current.isSessionExpired) onSessionExpired else null)
        is LoadState.Loaded -> when {
            current.value.size == 1 -> LoadingText("Загружаем дизайн-системы…")
            else -> PickerList(items = current.value, label = { it.name }, onSelect = { onSelect(it, false) })
        }
    }
}

@Composable
private fun PlatformStep(onSelect: (TokenPlatform) -> Unit) {
    // Android Studio может подсказать платформу, но не должна угадывать за пользователя —
    // ANDROID просто идёт первым в списке.
    val platforms = listOf(TokenPlatform.ANDROID, TokenPlatform.WEB, TokenPlatform.IOS)
    PickerList(items = platforms, label = { it.name }, onSelect = onSelect)
}

@Composable
private fun TokensStep(
    getDesignSystemTokens: GetDesignSystemTokensUseCase,
    project: Project,
    designSystem: DesignSystem,
    platform: TokenPlatform,
    initialMode: TokenMode,
    onSessionExpired: () -> Unit,
) {
    var mode by remember(project, designSystem, platform) { mutableStateOf(initialMode) }
    var state by remember(project, designSystem, platform, mode) {
        mutableStateOf<LoadState<List<TokenWithValue>>>(LoadState.Loading)
    }

    LaunchedEffect(project, designSystem, platform, mode) {
        state = runCatchingLoad { getDesignSystemTokens.execute(project.id, designSystem.id, platform, mode) }
    }

    Column(Modifier.fillMaxSize()) {
        ModeSwitch(mode = mode, onModeChange = { mode = it })
        when (val current = state) {
            is LoadState.Loading -> LoadingText("Загружаем токены…")
            is LoadState.Failed ->
                ErrorText(current.message, onLoginClick = if (current.isSessionExpired) onSessionExpired else null)
            is LoadState.Loaded -> TokenList(current.value, modifier = Modifier.weight(1f))
        }
    }
}

private val TOKEN_MODES = listOf(TokenMode.LIGHT, TokenMode.DARK)

private fun TokenMode.label(): String = when (this) {
    TokenMode.LIGHT -> "Светлая"
    TokenMode.DARK -> "Тёмная"
}

@Composable
private fun ModeSwitch(mode: TokenMode, onModeChange: (TokenMode) -> Unit) {
    Tabs(
        modifier = Modifier
            .padding(horizontal = SddsServTheme.spacing.spacing4x, vertical = SddsServTheme.spacing.spacing2x),
        style = TabsStyles.TabsDefaultS.style {
            dimensions {
                contentPaddingStart(0.dp)
                contentPaddingEnd(0.dp)
            }
        },
        selectedTabIndex = TOKEN_MODES.indexOf(mode),
        onTabClicked = { index -> onModeChange(TOKEN_MODES[index]) },
        stretch = false,
    ) {
        TOKEN_MODES.forEach { tokenMode ->
            tab { isSelected ->
                TabItem(
                    style = TabItemStyles.TabItemDefaultS.style {
                        dimensions {
                            paddingStart(0.dp)
                            paddingEnd(0.dp)
                        }
                    },
                    isSelected = isSelected,
                    label = tokenMode.label(),
                )
            }
        }
    }
}

@Suppress("TooGenericExceptionCaught")
private suspend fun <T> runCatchingLoad(block: suspend () -> T): LoadState<T> = try {
    LoadState.Loaded(block())
} catch (exception: SessionExpiredException) {
    LoadState.Failed(exception.message ?: "Сессия истекла.", isSessionExpired = true)
} catch (exception: Exception) {
    LoadState.Failed(exception.message ?: "Не удалось загрузить данные.")
}

@Composable
private fun LoadingText(text: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = text,
            color = SddsServTheme.colors.textDefaultSecondary,
            style = SddsServTheme.typography.bodyMNormal,
        )
    }
}

@Composable
private fun ErrorText(message: String, onLoginClick: (() -> Unit)? = null) {
    Column(
        modifier = Modifier.fillMaxSize().padding(SddsServTheme.spacing.spacing6x),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = message,
            color = SddsServTheme.colors.textDefaultNegative,
            style = SddsServTheme.typography.bodyMNormal,
        )
        if (onLoginClick != null) {
            Spacer(Modifier.height(SddsServTheme.spacing.spacing4x))
            Button(
                label = "Войти",
                onClick = onLoginClick,
                style = BasicButtonStyles.BasicButtonLAccent.style(),
            )
        }
    }
}
