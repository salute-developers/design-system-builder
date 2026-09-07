package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.domain.TargetPlatform

/**
 * Порт платформенного шага документации: инструмент платформы насыщает дерево `.sdds/temp/docs`
 * примерами, скриншотами и info-артефактами до того, как CLI соберёт из него пакет.
 */
internal fun interface DocsPlatformAggregator {
    /**
     * Запускает платформенную агрегацию.
     *
     * @param platform целевая платформа.
     * @param toolOverride путь инструмента из `--tool`.
     */
    fun aggregate(platform: TargetPlatform, toolOverride: String?): DocsAggregationResult
}

/**
 * Результат платформенного шага.
 */
internal sealed interface DocsAggregationResult {
    /**
     * Дерево собрано платформенным инструментом.
     *
     * @property docsDir директория собранного дерева.
     * @property toolchain toolchain, который его собрал.
     */
    data class Aggregated(
        val docsDir: String,
        val toolchain: String,
    ) : DocsAggregationResult

    /**
     * Платформенного шага нет: для платформы не зарегистрирован делегат или он не умеет агрегацию.
     * Пакет собирается из уже готового дерева — так работали сборки до появления делегатов.
     */
    data object Skipped : DocsAggregationResult

    /**
     * Платформенный шаг запустился и завершился с ошибкой.
     *
     * @property message user-facing объяснение.
     */
    data class Failed(
        val message: String,
    ) : DocsAggregationResult
}
