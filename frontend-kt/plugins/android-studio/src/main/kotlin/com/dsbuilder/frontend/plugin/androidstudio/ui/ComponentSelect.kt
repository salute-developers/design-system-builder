package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.sdds.compose.uikit.Select
import com.sdds.compose.uikit.SelectButton
import com.sdds.compose.uikit.SelectItem
import com.sdds.compose.uikit.SelectState
import com.sdds.compose.uikit.Text
import com.sdds.compose.uikit.imageVectorSource
import com.sdds.compose.uikit.style.style
import com.sdds.icons.compose.ChevronDown24
import com.sdds.icons.compose.ChevronUp24
import com.sdds.icons.compose.SddsIcons
import com.sdds.serv.styles.select.S
import com.sdds.serv.styles.select.SelectSingleNormal
import com.sdds.serv.theme.SddsServTheme

/** Поле выбора оформления или оси вариации, как в инспекторе клиента DS Builder. */
@Composable
internal fun ComponentSelect(label: String, values: List<String>, selected: String, onSelect: (String) -> Unit) {
    val selectState = remember(label, values) { SelectState() }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            label,
            textColor = SddsServTheme.colors.textDefaultSecondary,
            style = SddsServTheme.typography.bodyXsNormal,
        )
        Select(
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
            state = selectState,
            style = SelectSingleNormal.S.style(),
            trigger = {
                SelectButton(
                    label = selected,
                    modifier = Modifier.fillMaxWidth(),
                    iconOpened = imageVectorSource(SddsIcons.ChevronUp24),
                    iconClosed = imageVectorSource(SddsIcons.ChevronDown24),
                )
            },
            listContent = {
                items(values.size) { index ->
                    val value = values[index]
                    SelectItem(
                        checked = value == selected,
                        onClick = {
                            onSelect(value)
                            selectState.close()
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(value) }
                }
            },
        )
    }
}
