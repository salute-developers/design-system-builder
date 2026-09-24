package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import com.sdds.compose.uikit.SegmentHorizontal
import com.sdds.compose.uikit.SegmentItem
import com.sdds.serv.styles.segment.SegmentStyles
import com.sdds.serv.styles.segment.style

/**
 * Переключатель одного значения из набора на `Segment` из дизайн-системы (сейчас — тип токенов).
 * Ширина по содержимому; при [scrollable] сегмент прокручивается по горизонтали (у `SegmentHorizontal` собственного скролла нет), а выбранный пункт
 * всегда возвращается в видимую область — в том числе после сворачивания панели, когда выбор
 * сохранился, а положение скролла — нет.
 */
@Composable
internal fun <T> FilterSegment(
    items: List<T>,
    selectedIndex: Int,
    label: (T) -> String,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    scrollable: Boolean = false,
) {
    val scrollModifier = if (scrollable) Modifier.horizontalScroll(rememberScrollState()) else Modifier
    val style = SegmentStyles.SegmentXsPrimary.style()

    SegmentHorizontal(
        modifier = modifier.then(scrollModifier),
        style = style,
        stretch = false,
    ) {
        items.forEachIndexed { index, item ->
            segmentItem {
                val isSelected = index == selectedIndex
                val interactionSource = remember { MutableInteractionSource() }
                val bringIntoView = remember { BringIntoViewRequester() }
                if (isSelected && scrollable) {
                    LaunchedEffect(Unit) { bringIntoView.bringIntoView() }
                }
                SegmentItem(
                    label = label(item),
                    isSelected = isSelected,
                    interactionSource = interactionSource,
                    // SegmentItem только рисует состояние, клик и семантику выбора добавляем сами;
                    // interactionSource общий, чтобы hover/pressed красили пункт.
                    modifier = Modifier
                        .bringIntoViewRequester(bringIntoView)
                        .selectable(
                            selected = isSelected,
                            interactionSource = interactionSource,
                            indication = null,
                            role = Role.RadioButton,
                            onClick = { onSelect(index) },
                        ),
                )
            }
        }
    }
}
