package com.dsbuilder.ds.core.application

/** Одна доказуемая несовместимость или предупреждение; идентификатор не зависит от страницы. */
data class CoreCompatibilityIssue(
    /** Стабильный ID проблемы, независимый от страницы и фильтра. */
    val issueId: String,
    /** Машиночитаемая причина проблемы. */
    val code: String,
    /** blocking запрещает публикацию и экспорт; warning только предупреждает. */
    val severity: String,
    /** Точное расположение назначения в выбранной границе. */
    val location: CoreProblemLocation,
    /** Исходные данные назначения; null для проблемы компонента целиком. */
    val storedValue: CoreProblemValue?,
    /** Допустимые действия; пусто для исторической границы. */
    val allowedActions: List<String>,
)
