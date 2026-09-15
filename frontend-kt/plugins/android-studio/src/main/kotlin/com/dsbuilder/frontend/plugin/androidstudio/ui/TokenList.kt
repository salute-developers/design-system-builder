package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenType
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenWithValue
import com.sdds.compose.uikit.Divider
import com.sdds.compose.uikit.ListItem
import com.sdds.compose.uikit.TabItem
import com.sdds.compose.uikit.Tabs
import com.sdds.compose.uikit.TabsClip
import com.sdds.compose.uikit.TextField
import com.sdds.serv.styles.divider.DividerStyles
import com.sdds.serv.styles.divider.style
import com.sdds.serv.styles.listitem.ListItemStyles
import com.sdds.serv.styles.listitem.style
import com.sdds.serv.styles.tabitem.TabItemStyles
import com.sdds.serv.styles.tabitem.style
import com.sdds.serv.styles.tabs.TabsStyles
import com.sdds.serv.styles.tabs.style
import com.sdds.serv.styles.textfield.TextFieldStyles
import com.sdds.serv.styles.textfield.style
import com.sdds.serv.theme.SddsServTheme

private val SWATCH_SIZE = 32.dp
private val SWATCH_SHAPE = RoundedCornerShape(8.dp)

/** Вкладка над списком токенов: либо один из встречающихся [TokenType], либо "прочее" (`null`). */
private typealias TypeFilter = TokenType?

/**
 * Список токенов выбранной дизайн-системы: вкладки по типу токена (когда типов больше одного)
 * и поиск по имени внутри выбранной вкладки. Компоненты — из `sdds-uikit-compose`/`sdds-serv`,
 * как и остальной UI плагина. Read-only — ничего не пишет ни в проект пользователя.
 */
@Composable
public fun TokenList(tokens: List<TokenWithValue>, modifier: Modifier = Modifier) {
    // FONT_FAMILY нечего показывать пользователю осмысленно — значение это просто имя шрифта,
    // отдельная вкладка под него не нужна.
    val visibleTypeTokens = remember(tokens) { tokens.filter { it.token.type != TokenType.FONT_FAMILY } }
    val types = remember(visibleTypeTokens) { visibleTypeTokens.map { it.token.type }.distinct() }
    var selectedIndex by remember(tokens) { mutableStateOf(0) }
    var query by remember(tokens) { mutableStateOf("") }
    val selectedType = types.getOrNull(selectedIndex)

    val visibleTokens = remember(visibleTypeTokens, selectedType, query) {
        visibleTypeTokens
            .asSequence()
            .filter { it.token.type == selectedType }
            .filter { item -> query.isBlank() || item.matchesQuery(query) }
            .toList()
    }

    Column(modifier.fillMaxSize()) {
        if (types.size > 1) {
            TokenTypeTabs(types = types, selectedIndex = selectedIndex, onSelect = { selectedIndex = it })
        }
        TokenSearchField(query = query, onQueryChange = { query = it })

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            if (visibleTokens.isEmpty()) {
                NoMatchesText()
            } else {
                visibleTokens.forEach { item ->
                    TokenRow(item)
                    Divider(style = DividerStyles.DividerDefault.style())
                }
            }
        }
    }
}

private fun TokenWithValue.matchesQuery(query: String): Boolean =
    token.name.contains(query, ignoreCase = true) || token.displayName?.contains(query, ignoreCase = true) == true

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
private fun TokenTypeTabs(types: List<TypeFilter>, selectedIndex: Int, onSelect: (Int) -> Unit) {
    Tabs(
        // У Tabs/TabItem есть собственный встроенный отступ перед текстом (TabsDimensions
        // .contentPaddingStart, TabItemDimensions.paddingStart) — обнуляем оба, чтобы единственным
        // источником отступа слева был внешний Modifier.padding ниже, тот же, что у хлебных
        // крошек и поля поиска.
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = SddsServTheme.spacing.spacing4x, vertical = SddsServTheme.spacing.spacing2x),
        style = TabsStyles.TabsDefaultS.style {
            dimensions {
                contentPaddingStart(0.dp)
                contentPaddingEnd(0.dp)
            }
        },
        selectedTabIndex = selectedIndex,
        onTabClicked = onSelect,
        clip = TabsClip.Scroll,
        stretch = false,
    ) {
        types.forEach { type ->
            tab { isSelected ->
                TabItem(
                    style = TabItemStyles.TabItemDefaultS.style {
                        dimensions {
                            paddingStart(0.dp)
                            paddingEnd(0.dp)
                        }
                    },
                    isSelected = isSelected,
                    label = type.label(),
                )
            }
        }
    }
}

@Composable
private fun TokenSearchField(query: String, onQueryChange: (String) -> Unit) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = SddsServTheme.spacing.spacing4x, vertical = SddsServTheme.spacing.spacing2x),
        style = TextFieldStyles.TextFieldMDefault.style(),
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
            color = SddsServTheme.colors.textDefaultSecondary,
            style = SddsServTheme.typography.bodyMNormal,
        )
    }
}

@Composable
private fun TokenRow(item: TokenWithValue) {
    val colorSwatch: (@Composable RowScope.() -> Unit)? = if (item.token.type == TokenType.COLOR) {
        {
            val color = parseHexColor(item.value?.rawValue)
            Column(
                modifier = Modifier
                    .size(SWATCH_SIZE)
                    .background(color ?: Color.Transparent, SWATCH_SHAPE),
            ) {}
        }
    } else {
        null
    }

    ListItem(
        modifier = Modifier.fillMaxWidth(),
        style = ListItemStyles.ListItemNormalM.style(),
        text = item.token.displayName ?: item.token.name,
        // rawValue пустой, если значение опубликовано, но само поле value в БД равно null
        // (реальный случай — см. outline.default.accent) — показываем так же, как отсутствующее.
        subtitle = item.value?.rawValue?.ifBlank { null } ?: "—",
        startContent = colorSwatch,
    )
}

/** Разбирает `#RRGGBB`/`#AARRGGBB` из raw JSON-текста значения. `null`, если это не hex-цвет. */
internal fun parseHexColor(rawValue: String?): Color? {
    val hex = rawValue?.trim()?.trim('"')?.removePrefix("#") ?: return null

    return try {
        when (hex.length) {
            6 -> Color(
                red = hex.substring(0, 2).toInt(16),
                green = hex.substring(2, 4).toInt(16),
                blue = hex.substring(4, 6).toInt(16),
            )
            8 -> Color(
                alpha = hex.substring(0, 2).toInt(16),
                red = hex.substring(2, 4).toInt(16),
                green = hex.substring(4, 6).toInt(16),
                blue = hex.substring(6, 8).toInt(16),
            )
            else -> null
        }
    } catch (exception: NumberFormatException) {
        null
    }
}
