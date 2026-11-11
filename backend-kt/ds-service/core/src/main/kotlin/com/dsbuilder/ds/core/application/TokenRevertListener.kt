package com.dsbuilder.ds.core.application

import java.util.UUID

/**
 * Предметная реакция другой фичи на откат записи журнала об определении токена или его значении. Обработчик журнала
 * вызывает [beforeRevert] до отката и полученное действие — после успешного отката в той же транзакции, например
 * для пересчёта производного типа цветового токена.
 */
fun interface TokenRevertListener {
    /** Реакцию покрывает пакетный план при неизменном производном типе цветового семейства. */
    val supportsLiteralValueBatchRevert: Boolean get() = false

    /**
     * Запоминает состояние токена [tokenId] дизайн-системы [designSystemId] до отката и возвращает действие, которое
     * выполняется после успешного отката записи `token` или `token-value`.
     */
    fun beforeRevert(designSystemId: UUID, tokenId: UUID): () -> Unit

    /** Действие для пакета; общий ключ допустим, если первое действие покрывает всю группу до отката. */
    fun beforeBatchRevert(designSystemId: UUID, tokenId: UUID): TokenRevertAction =
        TokenRevertAction(tokenId, beforeRevert(designSystemId, tokenId))

    /**
     * Блокирует предметные зависимости определения [tokenId] (определения семейства в устойчивом порядке) до
     * блокировки самой записи журнала `token`. Порядок общий для записей значений (см. [TokenValueWritePolicy]):
     * существующее значение — значение, затем определения; новое значение — определения, затем ключ уникальности.
     * `false` — отказ отмены.
     */
    fun prepareRevert(designSystemId: UUID, tokenId: UUID): Boolean = true
}

/** Отложенное действие и предметный ключ для однократного выполнения в пакете. */
data class TokenRevertAction(
    /** Ключ группы в пределах одного слушателя и дизайн-системы. */
    val key: Any,
    /** Пересчёт по актуальному состоянию после всех мутаций пакета. */
    val run: () -> Unit,
)
