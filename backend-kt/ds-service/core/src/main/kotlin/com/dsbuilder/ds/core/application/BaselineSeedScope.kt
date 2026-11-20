package com.dsbuilder.ds.core.application

import java.util.UUID

/** Окно первичного наполнения базовой версии новой дизайн-системы. */
interface BaselineSeedScope {
    /**
     * Открывает окно для [designSystemId], вставленной в текущей транзакции и имеющей только базовую границу.
     * Пока окно открыто, построчные триггеры редакций не вызываются; иначе бросает исключение.
     */
    suspend fun begin(designSystemId: UUID)

    /** Закрывает окно и один раз проверяет целостность базовой версии теми же правилами, что и триггеры. */
    suspend fun verify(designSystemId: UUID)
}
