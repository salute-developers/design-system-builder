package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceResult
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenType
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenWithValue
import com.intellij.util.ui.UIUtil
import com.sdds.compose.uikit.AccordionItem
import com.sdds.compose.uikit.AccordionItemDimensions
import com.sdds.compose.uikit.AccordionItemStyle
import com.sdds.compose.uikit.Divider
import com.sdds.compose.uikit.Text
import com.sdds.compose.uikit.TextField
import com.sdds.serv.styles.accordion.AccordionStyles
import com.sdds.serv.styles.accordion.style
import com.sdds.serv.styles.divider.DividerStyles
import com.sdds.serv.styles.divider.style
import com.sdds.serv.styles.iconbutton.style
import com.sdds.serv.styles.listitem.style
import com.sdds.serv.styles.textfield.TextFieldStyles
import com.sdds.serv.styles.textfield.style
import com.sdds.serv.theme.SddsServTheme

/** Вкладка над списком токенов: либо один из встречающихся [TokenType], либо "прочее" (`null`). */
private typealias TypeFilter = TokenType?

/**
 * Список токенов выбранной дизайн-системы: сегмент типа токена (когда типов больше одного)
 * и поиск по имени внутри выбранного типа; [modeToggle] — кнопка режима темы справа от поиска, блокируется
 * на типах, значение которых не зависит от темы.
 * Компоненты — из `sdds-uikit-compose`/`sdds-serv`, как и остальной UI плагина. Read-only — ничего не пишет ни в проект пользователя.
 */
@Composable
public fun TokenList(
    tokens: List<TokenWithValue>,
    selectedTabIndex: Int,
    onTabSelected: (Int) -> Unit,
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    resolveCodeReference: (suspend (TokenWithValue) -> TokenCodeReferenceResult)? = null,
    modeToggle: @Composable (enabled: Boolean) -> Unit = {},
) {
    // FONT_FAMILY нечего показывать пользователю осмысленно — значение это просто имя шрифта,
    // отдельная вкладка под него не нужна.
    val visibleTypeTokens = remember(tokens) { tokens.filter { it.token.type != TokenType.FONT_FAMILY } }
    val types = remember(visibleTypeTokens) { orderedTokenTypes(visibleTypeTokens.map { it.token.type }) }
    // Вкладка и поиск хранятся снаружи (MainScreenState) и переживают сворачивание панели;
    // если типов стало меньше, индекс подрезается до допустимого.
    val selectedIndex = selectedTabIndex.coerceIn(0, (types.size - 1).coerceAtLeast(0))
    val selectedType = types.getOrNull(selectedIndex)

    val visibleTokens = remember(visibleTypeTokens, selectedType, query) {
        visibleTypeTokens
            .asSequence()
            .filter { it.token.type == selectedType }
            .toList()
            .let { typeTokens -> searchTokens(typeTokens, query) }
    }

    Column(modifier.fillMaxSize()) {
        // Единственный владелец вертикального ритма экрана: у блоков внутри своих вертикальных
        // отступов нет, шаг между ними и отступ снизу до списка — один и тот же (spacing4x). Сверху
        // достаточно spacing2x: к нему добавляется нижний отступ хлебных крошек, в сумме тоже шаг.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    start = SddsServTheme.spacing.spacing4x,
                    end = SddsServTheme.spacing.spacing4x,
                    top = SddsServTheme.spacing.spacing2x,
                    bottom = SddsServTheme.spacing.spacing4x,
                ),
            verticalArrangement = Arrangement.spacedBy(SddsServTheme.spacing.spacing4x),
        ) {
            if (types.size > 1) {
                FilterSegment(
                    items = types,
                    selectedIndex = selectedIndex,
                    label = { it.label() },
                    onSelect = onTabSelected,
                    scrollable = true,
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(SddsServTheme.spacing.spacing2x),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TokenSearchField(query = query, onQueryChange = onQueryChange, modifier = Modifier.weight(1f))
                modeToggle(selectedType.isThemeDependent())
            }
        }

        if (visibleTokens.isEmpty()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) { NoMatchesText() }
        } else {
            TokenListBody(visibleTokens, selectedType, query, resolveCodeReference)
        }
    }
}

/** Ленивый список токенов выбранного типа; для типографики — аккордеоны по классам экрана. */
@Composable
private fun TokenListBody(
    visibleTokens: List<TokenWithValue>,
    selectedType: TokenType?,
    query: String,
    resolveCodeReference: (suspend (TokenWithValue) -> TokenCodeReferenceResult)?,
) {
    // Ленивый список: в дизайн-системе сотни цветов, композировать их все сразу — фризы при прокрутке.
    // Divider приходит с тем же стилем, что и раньше, — дорогой `style()` считается один раз, а не на строку.
    val dividerStyle = DividerStyles.DividerDefault.style()
    Box(Modifier.fillMaxSize()) {
        val groups = remember(visibleTokens, selectedType) {
            if (selectedType == TokenType.TYPOGRAPHY) {
                groupByScreenClass(
                    visibleTokens,
                )
            } else {
                listOf(null to visibleTokens)
            }
        }
        // Аккордеон по классам экрана: по умолчанию раскрыт только первый; при поиске раскрыты все,
        // чтобы найденное не пряталось в свёрнутой группе.
        val expanded = remember(groups) {
            mutableStateMapOf<String, Boolean>().apply { groups.firstOrNull()?.first?.let { put(it, true) } }
        }
        val accordionBase = AccordionStyles.AccordionClearActionEndM.style().accordionItemStyle
        val edgePadding = SddsServTheme.spacing.spacing4x
        val accordionStyle =
            remember(accordionBase, edgePadding) { accordionBase.withHorizontalPadding(edgePadding) }
        // Лучшее совпадение стоит первым (см. searchTokens) — при новом запросе прокручиваем к началу.
        val listState = rememberLazyListState()
        LaunchedEffect(query) { if (query.isNotBlank()) listState.scrollToItem(0) }
        LazyColumn(Modifier.fillMaxSize(), state = listState) {
            groups.forEach { (screenClass, groupTokens) ->
                if (screenClass == null) {
                    items(items = groupTokens, key = { it.token.id }) { item ->
                        TokenRow(item, resolveCodeReference)
                        Divider(style = dividerStyle)
                    }
                } else {
                    item(key = "group:$screenClass") {
                        val isExpanded = query.isNotBlank() || expanded[screenClass] == true
                        AccordionItem(
                            modifier = Modifier.fillMaxWidth(),
                            style = accordionStyle,
                            opened = isExpanded,
                            title = screenClassTitle(screenClass),
                            onClick = { expanded[screenClass] = !isExpanded },
                        ) {
                            Column(Modifier.fillMaxWidth()) {
                                groupTokens.forEach { item ->
                                    TokenRow(item, resolveCodeReference)
                                    Divider(style = dividerStyle)
                                }
                            }
                        }
                        Divider(style = dividerStyle)
                    }
                }
            }
        }
        BottomFade(Modifier.align(Alignment.BottomCenter))
    }
}

/**
 * Затухание низа списка: список плавно уходит в фон панели IDE. Оверлей без обработчиков ввода —
 * клики и прокрутка проходят сквозь него к строкам.
 */
@Composable
private fun BottomFade(modifier: Modifier = Modifier) {
    val panel = UIUtil.getPanelBackground()
    val background = Color(panel.red, panel.green, panel.blue)
    Box(
        modifier
            .fillMaxWidth()
            .height(BOTTOM_FADE_HEIGHT)
            .background(Brush.verticalGradient(listOf(background.copy(alpha = 0f), background))),
    )
}

private val BOTTOM_FADE_HEIGHT = 48.dp

/** Стиль аккордеона у краёв без отступа: заголовок и иконка получают горизонтальный [padding], остальное — как в базовом стиле. */
private fun AccordionItemStyle.withHorizontalPadding(padding: Dp): AccordionItemStyle {
    val base = this
    val dimensions = object : AccordionItemDimensions by base.dimensions {
        override val paddingStart: Dp = padding
        override val paddingEnd: Dp = padding
    }
    return object : AccordionItemStyle by base {
        override val dimensions: AccordionItemDimensions = dimensions
    }
}

private fun TypeFilter.label(): String = when (this) {
    TokenType.COLOR -> "Цвета"
    TokenType.GRADIENT -> "Градиенты"
    TokenType.TYPOGRAPHY -> "Типографика"
    TokenType.SHADOW -> "Тени"
    TokenType.SHAPE -> "Формы"
    TokenType.SPACING -> "Размеры"
    TokenType.FONT_FAMILY -> "Шрифты" // отфильтровано выше, вкладка никогда не показывается
    null -> "Другое"
}

@Composable
private fun TokenSearchField(query: String, onQueryChange: (String) -> Unit, modifier: Modifier = Modifier) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier,
        style = TextFieldStyles.TextFieldSDefault.style(),
        placeholderText = "Поиск токена по имени…",
    )
}

@Composable
private fun NoMatchesText() {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Ничего не найдено",
            textColor = SddsServTheme.colors.textDefaultSecondary,
            style = SddsServTheme.typography.bodyMNormal,
        )
    }
}
