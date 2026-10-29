package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.core.application.TokenValueRead
import com.dsbuilder.ds.core.application.TokenValueReadPolicy
import com.dsbuilder.ds.core.application.publishAll
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.tokens.domain.TokenValue

/**
 * Значения [values] в форме для чтения по правилам других фич, например с раскрытыми ссылками на палитру темы и
 * сплошными значениями платформ градиентного токена слоем `color`. Без правил значения не меняются.
 */
internal suspend fun List<TokenValueReadPolicy>.published(
    projectId: ProjectId,
    values: List<TokenValue>,
): List<TokenValue> {
    if (isEmpty() || values.isEmpty()) return values
    val published = publishAll(projectId, values.map { it.read() }).associateBy { it.id }
    return values.map { value ->
        published[value.id]?.let { read ->
            value.copy(
                paletteId = read.paletteId,
                value = read.value,
                paletteRef = read.paletteRef,
                sourceValue = read.sourceValue,
            )
        } ?: value
    }
}

private fun TokenValue.read() = TokenValueRead(
    id = id,
    tokenId = tokenId,
    tenantId = tenantId,
    platform = platform?.wireValue,
    paletteId = paletteId,
    value = value,
    paletteRef = paletteRef,
    sourceValue = sourceValue,
)
