package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.sdds.compose.uikit.Divider
import com.sdds.compose.uikit.ListItem
import com.sdds.serv.styles.divider.DividerStyles
import com.sdds.serv.styles.divider.style
import com.sdds.serv.styles.listitem.ListItemStyles
import com.sdds.serv.styles.listitem.style

/**
 * Простой список для выбора одного элемента — используется для проекта, дизайн-системы и
 * платформы. Список, а не dropdown: в узком/низком tool window вертикальный список надёжнее.
 */
@Composable
public fun <T> PickerList(
    items: List<T>,
    label: (T) -> String,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
    sublabel: (T) -> String? = { null },
) {
    Column(modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
        items.forEach { item ->
            ListItem(
                modifier = Modifier.fillMaxWidth().clickable { onSelect(item) },
                style = ListItemStyles.ListItemNormalM.style(),
                text = label(item),
                subtitle = sublabel(item),
            )
            Divider(style = DividerStyles.DividerDefault.style())
        }
    }
}
