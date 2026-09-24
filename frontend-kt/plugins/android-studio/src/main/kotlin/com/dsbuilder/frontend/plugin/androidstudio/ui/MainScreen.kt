package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.window.PopupProperties
import com.dsbuilder.frontend.feature.projects.application.Project
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadErrorCode
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadResult
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenant
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsErrorCode
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsResult
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceResult
import com.dsbuilder.frontend.plugin.androidstudio.api.SessionExpiredException
import com.dsbuilder.frontend.plugin.androidstudio.tokens.DesignSystem
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GetDesignSystemTokensUseCase
import com.dsbuilder.frontend.plugin.androidstudio.tokens.ListDesignSystemsUseCase
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenMode
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenPlatform
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenWithValue
import com.sdds.compose.uikit.Button
import com.sdds.compose.uikit.IconButton
import com.sdds.compose.uikit.PopoverAlignment
import com.sdds.compose.uikit.PopoverPlacement
import com.sdds.compose.uikit.PopoverPlacementMode
import com.sdds.compose.uikit.Tooltip
import com.sdds.compose.uikit.TriggerInfo
import com.sdds.compose.uikit.popoverTrigger
import com.sdds.icons.compose.SddsIcons
import com.sdds.icons.compose.SleepOutline24
import com.sdds.icons.compose.SunOutline24
import com.sdds.serv.styles.basicbutton.BasicButtonStyles
import com.sdds.serv.styles.basicbutton.style
import com.sdds.serv.styles.iconbutton.IconButtonStyles
import com.sdds.serv.styles.iconbutton.style
import com.sdds.serv.styles.tooltip.TooltipStyles
import com.sdds.serv.styles.tooltip.style
import com.sdds.serv.theme.SddsServTheme

/**
 * Шаг просмотра: проект → дизайн-система → tenant → список токенов. Платформы нет — плагин только
 * для Android, см. [TOKENS_PLATFORM]. Шаг выбора tenant авто-пропускается при единственном варианте, как и остальные (см. [goTo] ниже).
 * Локальное состояние — приложение маленькое, отдельный слой ViewModel/StateFlow не оправдан.
 */
internal sealed interface Step {
    data object PickProject : Step
    data class PickDesignSystem(val project: Project) : Step
    data class PickTenant(val project: Project, val designSystem: DesignSystem) : Step
    data class ShowTokens(val project: Project, val designSystem: DesignSystem, val tenant: DesignSystemTenant) : Step
}

/**
 * Полный путь выбора для крошек: подпись выбранного элемента и шаг, на который он возвращает
 * (тот, где этот элемент выбирался). Авто-выбранные шаги в путь попадают, но не в историю.
 */
private fun Step.path(): List<Pair<String, Step>> = when (this) {
    is Step.PickProject -> emptyList()
    is Step.PickDesignSystem -> listOf(project.name to Step.PickProject)
    is Step.PickTenant -> listOf(project.name to Step.PickProject, designSystem.name to Step.PickDesignSystem(project))
    is Step.ShowTokens -> listOf(
        project.name to Step.PickProject,
        designSystem.name to Step.PickDesignSystem(project),
        tenant.name to Step.PickTenant(project, designSystem),
    )
}

/**
 * Состояние навигации главного экрана. Живёт вне композиции — у tool window, а не у `remember`:
 * при сворачивании панели `ComposePanel` сбрасывает композицию, и без этого пользователь
 * возвращался бы на первый шаг вместо экрана, на котором ушёл (например списка токенов).
 */
public class MainScreenState {
    internal var step: Step by mutableStateOf(Step.PickProject)
    internal val history: SnapshotStateList<Step> = mutableStateListOf()
    internal var tokenMode: TokenMode by mutableStateOf(TokenMode.LIGHT)
    internal var tokenTabIndex: Int by mutableIntStateOf(0)
    internal var tokenQuery: String by mutableStateOf("")

    /** Возвращает навигацию к выбору проекта (после выхода или истёкшей сессии). */
    public fun reset() {
        step = Step.PickProject
        history.clear()
        tokenMode = TokenMode.LIGHT
        tokenTabIndex = 0
        tokenQuery = ""
    }
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
    state: MainScreenState,
    listProjects: suspend () -> ProjectsReadResult,
    listDesignSystems: ListDesignSystemsUseCase,
    listTenants: suspend (projectId: String, designSystemId: String) -> DesignSystemTenantsResult,
    getTokenCodeReference: suspend (projectId: String, designSystemId: String, tokenName: String, mode: String) ->
    TokenCodeReferenceResult,
    getDesignSystemTokens: GetDesignSystemTokensUseCase,
    onSessionExpired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val history = state.history

    // Пропускаем шаг в историю (`replaceCurrent`), когда переход выбран автоматически —
    // единственный доступный вариант не должен оставлять в хлебных крошках шаг, который
    // пользователь на самом деле не выбирал (см. авто-переход при единственном проекте ниже).
    fun goTo(next: Step, replaceCurrent: Boolean = false) {
        if (!replaceCurrent) history.add(state.step)
        // Стартовый режим всегда светлый, независимо от темы IDE; дальше переключается явно.
        if (next is Step.ShowTokens) {
            state.tokenMode = TokenMode.LIGHT
            state.tokenTabIndex = 0
            state.tokenQuery = ""
        }
        state.step = next
    }

    fun goToBreadcrumb(target: Step) {
        val index = history.indexOf(target)
        if (index < 0) return
        state.step = target
        while (history.size > index) history.removeAt(history.lastIndex)
    }

    Column(modifier.fillMaxSize()) {
        Breadcrumbs(path = state.step.path(), history = history, onSelect = ::goToBreadcrumb)

        when (val currentStep = state.step) {
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
                    goTo(Step.PickTenant(currentStep.project, designSystem), replaceCurrent = autoSelected)
                }

            is Step.PickTenant ->
                TenantStep(
                    listTenants,
                    currentStep.project,
                    currentStep.designSystem,
                    onSessionExpired,
                ) { tenant, autoSelected ->
                    goTo(
                        Step.ShowTokens(currentStep.project, currentStep.designSystem, tenant),
                        replaceCurrent = autoSelected,
                    )
                }

            is Step.ShowTokens -> {
                TokensStep(
                    getDesignSystemTokens,
                    currentStep.project,
                    currentStep.designSystem,
                    currentStep.tenant,
                    state,
                    getTokenCodeReference,
                    onSessionExpired,
                )
            }
        }
    }
}

@Composable
private fun Breadcrumbs(path: List<Pair<String, Step>>, history: List<Step>, onSelect: (Step) -> Unit) {
    if (path.isEmpty()) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = SddsServTheme.spacing.spacing4x, vertical = SddsServTheme.spacing.spacing2x),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        path.forEachIndexed { index, (label, target) ->
            val isLast = index == path.lastIndex
            when {
                isLast -> Text(
                    text = label,
                    color = SddsServTheme.colors.textDefaultPrimary,
                    style = SddsServTheme.typography.bodySBold,
                )
                // Авто-выбранный шаг в историю не попадает — вернуться на него нельзя (выбор повторился бы сам).
                target in history -> BreadcrumbItem(label = label, onClick = { onSelect(target) })
                else -> Text(
                    text = label,
                    color = SddsServTheme.colors.textDefaultSecondary,
                    style = SddsServTheme.typography.bodySNormal,
                )
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
    listProjects: suspend () -> ProjectsReadResult,
    onSessionExpired: () -> Unit,
    onSelect: (Project, autoSelected: Boolean) -> Unit,
) {
    var state by remember { mutableStateOf<LoadState<List<Project>>>(LoadState.Loading) }

    LaunchedEffect(Unit) {
        state = when (val result = listProjects()) {
            is ProjectsReadResult.Success -> LoadState.Loaded(result.projects)
            is ProjectsReadResult.Failed -> LoadState.Failed(
                result.message,
                isSessionExpired = result.code == ProjectsReadErrorCode.AUTH_REQUIRED,
            )
        }
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
private fun TenantStep(
    listTenants: suspend (projectId: String, designSystemId: String) -> DesignSystemTenantsResult,
    project: Project,
    designSystem: DesignSystem,
    onSessionExpired: () -> Unit,
    onSelect: (DesignSystemTenant, autoSelected: Boolean) -> Unit,
) {
    var state by remember(
        project,
        designSystem,
    ) { mutableStateOf<LoadState<List<DesignSystemTenant>>>(LoadState.Loading) }

    LaunchedEffect(project, designSystem) {
        state = when (val result = listTenants(project.id, designSystem.id)) {
            is DesignSystemTenantsResult.Success -> LoadState.Loaded(result.tenants)
            is DesignSystemTenantsResult.Failed -> LoadState.Failed(
                result.message,
                isSessionExpired = result.code == DesignSystemTenantsErrorCode.AUTH_REQUIRED,
            )
        }
    }

    val current = state
    if (current is LoadState.Loaded && current.value.size == 1) {
        // Единственный tenant — дефолт: пикер не показываем, как и для единственного проекта/ДС.
        LaunchedEffect(current.value) { onSelect(current.value.single(), true) }
    }

    when (current) {
        is LoadState.Loading -> LoadingText("Загружаем tenant…")
        is LoadState.Failed ->
            ErrorText(current.message, onLoginClick = if (current.isSessionExpired) onSessionExpired else null)
        is LoadState.Loaded -> when {
            current.value.isEmpty() -> ErrorText("У дизайн-системы нет доступных tenant.")
            current.value.size == 1 -> LoadingText("Загружаем tenant…")
            else -> PickerList(
                items = current.value,
                label = { it.name },
                sublabel = { it.description },
                onSelect = { onSelect(it, false) },
            )
        }
    }
}

/**
 * Плагин работает только с Android: платформа не выбирается. Значения и code-ссылки токенов
 * запрашиваются для `android`.
 */
private val TOKENS_PLATFORM = TokenPlatform.ANDROID

@Composable
private fun TokensStep(
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
private fun ModeToggle(mode: TokenMode, onModeChange: (TokenMode) -> Unit, enabled: Boolean) {
    val icon = when (mode) {
        TokenMode.LIGHT -> SddsIcons.SunOutline24
        TokenMode.DARK -> SddsIcons.SleepOutline24
    }
    val next = if (mode == TokenMode.LIGHT) TokenMode.DARK else TokenMode.LIGHT
    // hoverable на обёртке, а не на кнопке: у заблокированной кнопки hover может не доходить.
    val hoverSource = remember { MutableInteractionSource() }
    val isHovered by hoverSource.collectIsHoveredAsState()
    val triggerInfo = remember { mutableStateOf(TriggerInfo()) }

    Box(Modifier.hoverable(hoverSource).popoverTrigger(triggerInfo)) {
        IconButton(
            icon = rememberVectorPainter(icon),
            onClick = { onModeChange(next) },
            style = IconButtonStyles.IconButtonSSecondary.style(),
            enabled = enabled,
            iconContentDescription = "Режим темы: ${mode.label()}",
        )
        Tooltip(
            show = isHovered,
            onDismissRequest = {},
            triggerInfo = { triggerInfo.value },
            style = TooltipStyles.TooltipS.style(),
            text = AnnotatedString(
                if (enabled) {
                    "${mode.label()} тема, переключить на ${next.label().lowercase()}"
                } else {
                    "Режим темы влияет только на цвета и градиенты"
                },
            ),
            placement = PopoverPlacement.Bottom,
            placementMode = PopoverPlacementMode.StrictClipped,
            // Кнопка у правого края панели — выравниваем по её концу, чтобы подсказка росла влево.
            alignment = PopoverAlignment.End,
            // Подсказка по наведению не должна забирать фокус у поля поиска.
            popupProperties = PopupProperties(focusable = false, clippingEnabled = false),
        )
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
