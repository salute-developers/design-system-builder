package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.awt.SwingPanel
import androidx.compose.ui.unit.dp
import com.dsbuilder.frontend.plugin.androidstudio.PluginServices
import com.dsbuilder.frontend.plugin.androidstudio.api.SessionExpiredException
import com.dsbuilder.frontend.plugin.androidstudio.codereference.ClipboardCopier
import com.dsbuilder.frontend.plugin.androidstudio.components.CatalogComponent
import com.dsbuilder.frontend.plugin.androidstudio.components.ComponentBundle
import com.dsbuilder.frontend.plugin.androidstudio.components.ComponentConfiguration
import com.dsbuilder.frontend.plugin.androidstudio.components.ComponentContext
import com.dsbuilder.frontend.plugin.androidstudio.components.ComponentDraftLoader
import com.dsbuilder.frontend.plugin.androidstudio.components.axes
import com.dsbuilder.frontend.plugin.androidstudio.components.axisValues
import com.dsbuilder.frontend.plugin.androidstudio.components.defaultSelections
import com.dsbuilder.frontend.plugin.androidstudio.preview.AssemblyResult
import com.dsbuilder.frontend.plugin.androidstudio.preview.PayloadAssembler
import com.dsbuilder.frontend.plugin.androidstudio.preview.PreviewBrowser
import com.dsbuilder.frontend.plugin.androidstudio.preview.loadPreviewManifest
import com.dsbuilder.frontend.plugin.androidstudio.preview.previewExampleProps
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenMode
import com.intellij.ui.jcef.JBCefApp
import com.sdds.compose.uikit.Button
import com.sdds.compose.uikit.ListItem
import com.sdds.compose.uikit.Text
import com.sdds.compose.uikit.TextField
import com.sdds.serv.styles.basicbutton.BasicButtonStyles
import com.sdds.serv.styles.basicbutton.style
import com.sdds.serv.styles.listitem.ListItemStyles
import com.sdds.serv.styles.listitem.style
import com.sdds.serv.styles.textfield.TextFieldStyles
import com.sdds.serv.styles.textfield.style
import com.sdds.serv.theme.SddsServTheme
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.launch

internal class ComponentsPreviewState(val supported: Boolean) {
    var state: LoadState<PreviewBrowser> by mutableStateOf(LoadState.Loading)
}

internal class ComponentsState {
    var selected: CatalogComponent? by mutableStateOf(null)
    var query: String by mutableStateOf("")
    var revision: Long = 0
        private set
    private var configuration: String by mutableStateOf("")
    var configurationName: String
        get() = configuration
        set(value) {
            if (configuration != value) revision++
            configuration = value
        }
    private var selectedValues: Map<String, String> by mutableStateOf(emptyMap())
    var selections: Map<String, String>
        get() = selectedValues
        set(value) {
            if (selectedValues != value) revision++
            selectedValues = value
        }
    var mode: String by mutableStateOf("light")
    val listScroll = ScrollState(0)
}

@Composable
internal fun ComponentsStep(
    projectId: String,
    designSystemId: String,
    tenantId: String,
    state: ComponentsState,
    onSessionExpired: () -> Unit,
) {
    val context = remember(
        projectId,
        designSystemId,
        tenantId,
    ) {
        ComponentContext(
            projectId,
            designSystemId,
            tenantId,
        )
    }
    var attempt by remember { mutableIntStateOf(0) }
    val preview = rememberSectionPreview(context, attempt)
    var catalogState by remember(
        context,
        attempt,
    ) { mutableStateOf<LoadState<List<CatalogComponent>>>(LoadState.Loading) }
    LaunchedEffect(
        context,
        attempt,
    ) { catalogState = runCatchingLoad { PluginServices.componentCatalog.list(context) } }
    when (val current = catalogState) {
        LoadState.Loading -> LoadingText("Загружаем компоненты…")
        is LoadState.Failed -> ComponentError(
            current.message,
            current.isSessionExpired,
            onSessionExpired,
        ) { attempt++ }
        is LoadState.Loaded -> {
            val scope = rememberCoroutineScope()
            val loader = remember(
                context,
                current.value,
                attempt,
            ) {
                ComponentDraftLoader(
                    PluginServices.componentCatalog,
                    context,
                    scope,
                    current.value,
                )
            }
            LaunchedEffect(loader, preview.state) {
                val browser = (preview.state as? LoadState.Loaded)?.value
                if (browser != null) runCatchingLoad { browser.preloadFonts(loader.defaultFontPayload()) }
            }
            if (state.selected == null) {
                ComponentList(current.value, state) {
                    state.selected = it
                    state.configurationName = ""
                    state.selections = emptyMap()
                }
            } else {
                ComponentWindow(context, loader, state, preview, onSessionExpired) { attempt++ }
            }
        }
    }
}

internal fun searchComponents(components: List<CatalogComponent>, query: String): List<CatalogComponent> {
    val text = query.trim()
    return if (text.isEmpty()) components else components.filter { it.name.contains(text, ignoreCase = true) }
}

@Composable
private fun ComponentList(
    components: List<CatalogComponent>,
    state: ComponentsState,
    onSelect: (CatalogComponent) -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(SddsServTheme.spacing.spacing4x)) {
        TextField(
            value = state.query,
            onValueChange = { state.query = it },
            style = TextFieldStyles.TextFieldSDefault.style(),
            placeholderText = "Поиск компонента…",
        )
        val filtered = searchComponents(components, state.query)
        if (filtered.isEmpty()) {
            val message = if (components.isEmpty()) {
                "В дизайн-системе нет Compose-компонентов"
            } else {
                "Ничего не найдено"
            }
            Text(message)
        } else {
            Column(Modifier.verticalScroll(state.listScroll)) {
                filtered.forEach { component ->
                    ListItem(
                        text = component.name,
                        style = ListItemStyles.ListItemNormalM.style(),
                        modifier = Modifier.fillMaxWidth().clickable { onSelect(component) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ComponentWindow(
    context: ComponentContext,
    loader: ComponentDraftLoader,
    state: ComponentsState,
    preview: ComponentsPreviewState,
    onSessionExpired: () -> Unit,
    retry: () -> Unit,
) {
    val component = requireNotNull(state.selected)
    var data by remember(
        component,
        loader,
    ) { mutableStateOf<LoadState<ComponentBundle>>(LoadState.Loading) }
    LaunchedEffect(component, loader) {
        data = runCatchingLoad { loader.bundle(component) }
        val bundle = (data as? LoadState.Loaded)?.value
        if (bundle != null && bundle.configurations.none { it.styleName == state.configurationName }) {
            state.configurationName = bundle.configurations.firstOrNull()?.styleName.orEmpty()
            state.selections = bundle.configurations.firstOrNull()?.defaultSelections().orEmpty()
        }
    }
    Column(
        Modifier.fillMaxSize().padding(SddsServTheme.spacing.spacing4x).verticalScroll(remember { ScrollState(0) }),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Button(
            label = "К списку",
            onClick = { state.selected = null },
            style = BasicButtonStyles.BasicButtonSSecondary.style(),
        )
        Text(component.name)
        when (val current = data) {
            LoadState.Loading -> Text("Загружаем конфигурации…")
            is LoadState.Failed -> ComponentError(
                current.message,
                current.isSessionExpired,
                onSessionExpired,
                retry,
            )
            is LoadState.Loaded -> {
                val configurations = current.value.configurations
                val configuration = configurations.singleOrNull { it.styleName == state.configurationName }
                if (configuration == null) {
                    Text("У компонента нет конфигураций")
                } else {
                    ComponentControls(configurations, configuration, state)
                    CopyComponentStyle(context, configuration, state, onSessionExpired)
                    ComponentPreview(preview, loader, current.value, configuration, state, onSessionExpired, retry)
                }
            }
        }
    }
}

@Composable
private fun ComponentControls(
    configurations: List<ComponentConfiguration>,
    configuration: ComponentConfiguration,
    state: ComponentsState,
) {
    if (configurations.size > 1) {
        ComponentSelect(
            "Конфигурация",
            configurations.map { it.styleName },
            configuration.styleName,
            { name ->
                state.configurationName = name
                state.selections = configurations.single { it.styleName == name }.defaultSelections()
            },
        )
    }
    configuration.axes().forEach { axis ->
        val name = axis.text("name").orEmpty()
        val values = axisValues(axis).map { it.text("name").orEmpty() }
        if (values.size > 1) {
            ComponentSelect(name, values, state.selections[name].orEmpty()) {
                state.selections = state.selections + (name to it)
            }
        }
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("Тема превью")
        Spacer(Modifier.weight(1f))
        ModeToggle(
            if (state.mode == "dark") TokenMode.DARK else TokenMode.LIGHT,
            { state.mode = if (it == TokenMode.DARK) "dark" else "light" },
            enabled = true,
        )
    }
}

@Composable
private fun CopyComponentStyle(
    context: ComponentContext,
    configuration: ComponentConfiguration,
    state: ComponentsState,
    onSessionExpired: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val selection = state.selections
    var status by remember(configuration, selection) { mutableStateOf("Копировать стиль") }
    Button(
        label = status,
        enabled = status != "Загрузка…",
        style = BasicButtonStyles.BasicButtonSSecondary.style(),
        onClick = {
            val selectedConfiguration = state.configurationName
            val revision = state.revision
            status = "Загрузка…"
            scope.launch {
                try {
                    val reference = PluginServices.componentStyleReferences.resolve(
                        context,
                        configuration,
                        selection,
                    )
                    val changed = revision != state.revision || selectedConfiguration != state.configurationName ||
                        selection != state.selections
                    if (changed) return@launch
                    if (reference == null) {
                        status = "Нет ссылки"
                    } else {
                        ClipboardCopier.copy("$reference.style()")
                        status = "Скопировано"
                    }
                } catch (exception: CancellationException) {
                    throw exception
                } catch (_: SessionExpiredException) {
                    onSessionExpired()
                } catch (_: Exception) {
                    status = "Ошибка"
                }
            }
        },
    )
}

@Composable
private fun rememberSectionPreview(
    context: ComponentContext,
    attempt: Int,
): ComponentsPreviewState {
    val holder = remember(context, attempt) { ComponentsPreviewState(JBCefApp.isSupported()) }
    DisposableEffect(holder) {
        onDispose { (holder.state as? LoadState.Loaded)?.value?.close() }
    }
    LaunchedEffect(holder) {
        if (holder.supported) {
            holder.state = runCatchingLoad {
                val manifest = HttpClient(CIO) { followRedirects = false }.use { http ->
                    loadPreviewManifest(http, PluginServices.componentCatalog.pluginUrl(context))
                }
                PreviewBrowser.create(manifest)
            }
        }
    }
    return holder
}

@Composable
private fun ComponentPreview(
    holder: ComponentsPreviewState,
    loader: ComponentDraftLoader,
    bundle: ComponentBundle,
    configuration: ComponentConfiguration,
    state: ComponentsState,
    onSessionExpired: () -> Unit,
    retry: () -> Unit,
) {
    if (!holder.supported) {
        Text("Превью недоступно в этой IDE: требуется JBR с JCEF")
        return
    }
    when (val current = holder.state) {
        LoadState.Loading -> Box(Modifier.fillMaxWidth().height(350.dp), contentAlignment = Alignment.Center) {
            Text("Загружаем превью…")
        }
        is LoadState.Failed -> ComponentError(current.message, current.isSessionExpired, onSessionExpired, retry)
        is LoadState.Loaded -> {
            if (bundle.component.name !in current.value.manifest.components) {
                Text("Компонент не поддерживается опубликованным плагином превью")
            } else {
                BrowserPreview(current.value, loader, bundle, configuration, state, onSessionExpired, retry)
            }
        }
    }
}

@Suppress("TooGenericExceptionCaught")
@Composable
private fun BrowserPreview(
    preview: PreviewBrowser,
    loader: ComponentDraftLoader,
    bundle: ComponentBundle,
    configuration: ComponentConfiguration,
    state: ComponentsState,
    onSessionExpired: () -> Unit,
    retry: () -> Unit,
) {
    var status by remember { mutableStateOf("Загружаем превью…") }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(preview, status, state.mode) { preview.showStatus(status, state.mode) }
    LaunchedEffect(preview, bundle, configuration, state.selections, state.mode) {
        loading = true
        status = "Обновляем превью…"
        preview.clearFrame()
        try {
            val description = preview.session.describe(bundle.component.name)
            val draft = loader.draft(
                bundle,
                configuration,
                state.selections,
                state.mode,
                requireNotNull(description.text("storyId")),
                previewExampleProps(description),
            )
            when (val assembled = PayloadAssembler.assemble(draft)) {
                is AssemblyResult.Success -> {
                    preview.render(assembled.payload)
                    status = ""
                }
                is AssemblyResult.Failed -> status = "${assembled.diagnostic.message}: ${assembled.diagnostic.path}"
            }
        } catch (_: SessionExpiredException) {
            onSessionExpired()
        } catch (_: TimeoutCancellationException) {
            status = "Превью не ответило вовремя. Повторите загрузку."
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            status = exception.message ?: "Не удалось показать превью"
        }
        loading = false
    }
    Box(Modifier.fillMaxWidth().height(350.dp)) {
        SwingPanel(factory = { preview.browser.component }, modifier = Modifier.fillMaxSize())
    }
    if (!loading && status.isNotEmpty()) {
        Button(
            label = "Повторить превью",
            onClick = retry,
            style = BasicButtonStyles.BasicButtonSSecondary.style(),
        )
    }
}

@Composable
private fun ComponentError(
    message: String,
    sessionExpired: Boolean,
    onSessionExpired: () -> Unit,
    retry: () -> Unit,
) {
    Text(message)
    Row {
        Button(
            label = if (sessionExpired) "Войти" else "Повторить",
            onClick = if (sessionExpired) onSessionExpired else retry,
            style = BasicButtonStyles.BasicButtonSSecondary.style(),
        )
    }
}
