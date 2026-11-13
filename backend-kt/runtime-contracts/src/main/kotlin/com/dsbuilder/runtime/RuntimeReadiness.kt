package com.dsbuilder.runtime

/**
 * Состояние обязательных зависимостей без секретных значений.
 * @property ready Готовность всех обязательных зависимостей.
 * @property checks Безопасные состояния отдельных проверок.
 */
data class RuntimeReadiness(val ready: Boolean, val checks: Map<String, Boolean>)
