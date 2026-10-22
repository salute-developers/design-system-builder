package com.dsbuilder.ds.core.application

import com.dsbuilder.ds.core.domain.ProjectId

/**
 * Форма значений общего маршрута чтения `GET /api/ds/token-values`, которую задаёт другая фича: например, раскрытие
 * ссылок на палитру темы и форма сплошных значений платформ по типу цветового токена. Вызывается в транзакции чтения
 * на границе выбранной версии.
 */
interface TokenValueReadPolicy {
    /** Значения [values] проекта [projectId] в форме для чтения; значения, которые правило не ведёт, не меняются. */
    suspend fun publish(projectId: ProjectId, values: List<TokenValueRead>): List<TokenValueRead>
}

/** Проводит значения [values] через все правила по очереди: каждое получает результат предыдущего. */
suspend fun List<TokenValueReadPolicy>.publishAll(
    projectId: ProjectId,
    values: List<TokenValueRead>,
): List<TokenValueRead> = fold(values) { current, policy -> policy.publish(projectId, current) }
