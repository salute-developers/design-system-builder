package com.dsbuilder.ds.components.application

/** Чтение значений свойств типа `icon`, сохранённых в конфигурациях всех дизайн-систем. */
interface IconUsageReader {
    /** Значения старого формата и число ссылок на каждое. */
    suspend fun usedValues(): Map<String, Int>
}
