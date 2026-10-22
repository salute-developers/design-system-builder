package com.dsbuilder.ds.core.application

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/**
 * Предметные правила другой фичи для значений, которые пишутся общими маршрутами `token-values`
 * (`POST`, `PATCH` и `DELETE /api/ds/token-values`). Вызываются в транзакции записи: [prepare] — до записи,
 * [afterWrite] — после успешной записи или удаления, например для пересчёта производного типа цветового токена.
 *
 * Единый порядок блокировок записи значений: существующее значение (`PATCH`, `DELETE`, откат `token-value`) —
 * сначала значение, затем определения семейства; новое значение (`POST`) — сначала определения семейства, затем
 * ключ уникальности значения. Откат определения (`token`) блокирует определения семейства до записи журнала
 * ([TokenRevertListener.prepareRevert]). [prepare] блокирует определения всегда, в том числе для пустого значения.
 */
interface TokenValueWritePolicy {
    /**
     * Хранимая форма значения [write] или отказ проверки. Значение токена, которое правило не ведёт, возвращается
     * без изменений.
     */
    suspend fun prepare(write: TokenValueWrite): DsResult<JsonElement?>

    /** Реакция на записанное или удалённое значение токена [tokenId] в той же транзакции. */
    suspend fun afterWrite(tokenId: UUID)
}

/**
 * Проводит значение [write] через все правила по очереди: каждое получает хранимую форму предыдущего. Первый отказ
 * прерывает подготовку.
 */
suspend fun List<TokenValueWritePolicy>.prepareAll(write: TokenValueWrite): DsResult<JsonElement?> =
    fold(DsResult.Success(write.value) as DsResult<JsonElement?>) { result, rule ->
        when (result) {
            is DsResult.Failure -> result
            is DsResult.Success -> rule.prepare(write.copy(value = result.value))
        }
    }
