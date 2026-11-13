package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceResult
import com.dsbuilder.frontend.plugin.androidstudio.codereference.ClipboardCopier
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenWithValue
import com.sdds.compose.uikit.IconButton
import com.sdds.compose.uikit.ListItem
import com.sdds.compose.uikit.Text
import com.sdds.icons.compose.CopyOutline24
import com.sdds.icons.compose.SddsIcons
import com.sdds.serv.styles.accordion.style
import com.sdds.serv.styles.divider.style
import com.sdds.serv.styles.iconbutton.IconButtonStyles
import com.sdds.serv.styles.iconbutton.style
import com.sdds.serv.styles.listitem.ListItemStyles
import com.sdds.serv.styles.listitem.style
import com.sdds.serv.styles.textfield.style
import com.sdds.serv.theme.SddsServTheme
import kotlinx.coroutines.launch

@Composable
internal fun TokenRow(
    item: TokenWithValue,
    resolveCodeReference: (suspend (TokenWithValue) -> TokenCodeReferenceResult)?,
) {
    val payload = item.payload
    val preview = previewContent(payload)

    ListItem(
        modifier = Modifier.fillMaxWidth(),
        style = ListItemStyles.ListItemNormalM.style(),
        text = item.visibleTitle(),
        subtitle = describeValue(payload, item.value?.rawValue),
        startContent = preview,
        endContent = resolveCodeReference?.let { resolve -> { CopyCodeReferenceAction(item, resolve) } },
    )
}

private enum class CopyStatus(val label: String, val style: IconButtonStyles) {
    IDLE("Копировать код", IconButtonStyles.IconButtonSSecondary),
    LOADING("Загрузка…", IconButtonStyles.IconButtonSSecondary),
    COPIED("Скопировано", IconButtonStyles.IconButtonSPositive),
    UNAVAILABLE("Нет ссылки", IconButtonStyles.IconButtonSNegative),
    FAILED("Ошибка", IconButtonStyles.IconButtonSNegative),
}

/**
 * Иконка-кнопка копирования: клик запрашивает code-ссылку токена и копирует её в буфер обмена.
 * Результат виден по цвету кнопки и короткой подписи слева от неё (в состоянии покоя подписи нет).
 */
@Composable
private fun CopyCodeReferenceAction(
    item: TokenWithValue,
    resolve: suspend (TokenWithValue) -> TokenCodeReferenceResult,
) {
    val scope = rememberCoroutineScope()
    var status by remember(item) { mutableStateOf(CopyStatus.IDLE) }
    val isError = status == CopyStatus.UNAVAILABLE || status == CopyStatus.FAILED

    Row(verticalAlignment = Alignment.CenterVertically) {
        if (status != CopyStatus.IDLE) {
            Text(
                text = status.label,
                textColor = if (isError) {
                    SddsServTheme.colors.textDefaultNegative
                } else {
                    SddsServTheme.colors.textDefaultSecondary
                },
                style = SddsServTheme.typography.bodyXsNormal,
            )
            Spacer(Modifier.width(SddsServTheme.spacing.spacing2x))
        }
        IconButton(
            icon = rememberVectorPainter(SddsIcons.CopyOutline24),
            onClick = {
                scope.launch {
                    status = CopyStatus.LOADING
                    status = copyCodeReference(item, resolve)
                }
            },
            style = status.style.style(),
            enabled = status != CopyStatus.LOADING,
            iconContentDescription = CopyStatus.IDLE.label,
        )
    }
}

@Suppress("TooGenericExceptionCaught")
private suspend fun copyCodeReference(
    item: TokenWithValue,
    resolve: suspend (TokenWithValue) -> TokenCodeReferenceResult,
): CopyStatus = try {
    when (val result = resolve(item)) {
        is TokenCodeReferenceResult.Found -> {
            ClipboardCopier.copy(result.reference)
            CopyStatus.COPIED
        }
        TokenCodeReferenceResult.NotAvailable -> CopyStatus.UNAVAILABLE
        is TokenCodeReferenceResult.Failed -> CopyStatus.FAILED
    }
} catch (exception: Exception) {
    CopyStatus.FAILED
}

/** Превью значения по типу — квадрат/полоска/текст-сэмпл вместо сырого JSON, где это возможно. */
