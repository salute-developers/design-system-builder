package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.Key
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

/**
 * Пакетный откат записей журнала в текущей транзакции. Пока пакет открыт, предметные действия после отката записи
 * (например, пересчёт типа семейства цветового токена) откладываются и выполняются по одному разу на ключ в конце
 * пакета, а не после каждой записи: промежуточные состояния пакета никто не видит.
 */
object DraftRevertBatch {
    private val ACTIONS = Key<LinkedHashMap<Any, () -> Unit>>()

    /** Открывает пакет в текущей транзакции. */
    fun begin() {
        TransactionManager.current().putUserData(ACTIONS, LinkedHashMap())
    }

    /**
     * Откладывает [action] до конца пакета; из нескольких действий с одним [key] остаётся первое — оно подготовлено
     * по состоянию до первого отката. `false` — пакета нет, действие нужно выполнить сразу.
     */
    fun defer(key: Any, action: () -> Unit): Boolean {
        val actions = TransactionManager.current().getUserData(ACTIONS) ?: return false
        actions.putIfAbsent(key, action)
        return true
    }

    /** Отложено ли уже действие с ключом [key]: его подготовку до отката можно не повторять. */
    fun isDeferred(key: Any): Boolean = TransactionManager.current().getUserData(ACTIONS)?.containsKey(key) == true

    /** Закрывает пакет и выполняет отложенные действия в порядке первого откладывания. */
    fun complete() {
        val actions = TransactionManager.current().removeUserData(ACTIONS)
        @Suppress("UNCHECKED_CAST")
        (actions as? LinkedHashMap<Any, () -> Unit>)?.values?.forEach { it() }
    }

    /** Закрывает пакет без выполнения отложенных действий: транзакция откатывается. */
    fun cancel() {
        TransactionManager.current().removeUserData(ACTIONS)
    }
}
