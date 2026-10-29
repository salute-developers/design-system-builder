package com.dsbuilder.ds.components.application

/**
 * Нарушение предметного правила операции редактора оформления.
 *
 * Исключение бросает слой `data` внутри транзакции, а use case превращает его в отказ `422` с кодом [code],
 * что откатывает транзакцию целиком.
 */
class EditorRuleViolationException(
    /** Устойчивый код отказа, например `axis_locked`. */
    val code: String,
    /** Безопасное сообщение для клиента. */
    message: String,
    /** Отказ является конфликтом состояния (`409`), а не недопустимой операцией (`422`). */
    val conflict: Boolean = false,
) : RuntimeException(message)
