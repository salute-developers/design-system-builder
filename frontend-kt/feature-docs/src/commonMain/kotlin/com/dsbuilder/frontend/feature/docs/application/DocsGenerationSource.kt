package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.PlatformResolution
import com.dsbuilder.frontend.core.platform.PlatformResolver
import com.dsbuilder.frontend.feature.docs.domain.DocumentationPlatform
import com.dsbuilder.frontend.feature.docs.domain.toDocumentationPlatform

/** Дерево документации по умолчанию, если платформенного шага не было и `--docs-dir` не задан. */
private const val DEFAULT_DOCS_DIR = ".sdds/temp/docs"

/** Историческое умолчание `docs generate`: проект без объявленной платформы собирает compose-пакет. */
private val DEFAULT_DOCUMENTATION_PLATFORM = TargetPlatform.COMPOSE

/** Выбирает платформу и исходное дерево документации до сборки пакета. */
internal class DocsGenerationSource(
    private val projectContextReader: DocsProjectContextReader,
    private val platformAggregator: DocsPlatformAggregator,
) {
    /**
     * Явный `--platform` побеждает и допускает платформы без делегата (например, `design`);
     * иначе платформа берётся из project config.
     *
     * Проект, не объявивший платформу, получает историческое умолчание `compose`: команда
     * существовала с ним до появления делегатов, и отказ сломал бы работающие сборки. Дерево,
     * собранное для другой платформы, всё равно не пройдёт: `meta/platform-context.json`
     * сверяется с выбранной платформой ниже.
     */
    fun selectPlatform(requested: String?): PlatformSelection {
        if (requested != null) {
            return explicitPlatform(requested)
        }

        return when (val read = projectContextReader.platforms()) {
            // Неверный config не превращаем в умолчание: пакет собрался бы с чужой платформой
            // и с `designSystem.id = unknown`, и никто бы этого не заметил.
            is DocsPlatformsRead.Invalid -> PlatformSelection.Failure(read.message)
            is DocsPlatformsRead.NotInitialized -> defaultPlatform()
            is DocsPlatformsRead.Configured -> configuredPlatform(read.platforms)
        }
    }

    private fun configuredPlatform(configured: List<TargetPlatform>): PlatformSelection {
        if (configured.isEmpty()) {
            return defaultPlatform()
        }

        return when (val resolution = PlatformResolver.resolve(null, configured)) {
            is PlatformResolution.Resolved -> PlatformSelection.Selected(
                documentation = resolution.platform.toDocumentationPlatform(),
                target = resolution.platform,
            )

            is PlatformResolution.Failed -> PlatformSelection.Failure(resolution.message)
        }
    }

    private fun defaultPlatform(): PlatformSelection = PlatformSelection.Selected(
        documentation = DEFAULT_DOCUMENTATION_PLATFORM.toDocumentationPlatform(),
        target = DEFAULT_DOCUMENTATION_PLATFORM,
    )

    /** Явная опция допускает и платформы без делегата, например `design`. */
    private fun explicitPlatform(requested: String): PlatformSelection {
        val documentation = DocumentationPlatform.fromManifestValue(requested)
            ?: return PlatformSelection.Failure("Unknown documentation platform: $requested")

        return PlatformSelection.Selected(
            documentation = documentation,
            target = TargetPlatform.fromCliValue(requested),
        )
    }

    /**
     * Заданный `--docs-dir` означает готовое дерево. Иначе дерево собирает платформенный
     * инструмент, а если его нет — берётся дерево по умолчанию.
     */
    fun selectDocsTree(
        command: DocsGenerateCommand,
        target: TargetPlatform?,
    ): DocsTreeSelection {
        if (command.docsDir != null) {
            return DocsTreeSelection.Selected(docsDir = command.docsDir, aggregatedBy = null)
        }
        if (!command.aggregate || target == null) {
            return DocsTreeSelection.Selected(docsDir = DEFAULT_DOCS_DIR, aggregatedBy = null)
        }

        return when (val aggregation = platformAggregator.aggregate(target, command.toolOverride)) {
            is DocsAggregationResult.Aggregated -> DocsTreeSelection.Selected(
                docsDir = aggregation.docsDir,
                aggregatedBy = aggregation.toolchain,
            )

            is DocsAggregationResult.Skipped -> DocsTreeSelection.Selected(
                docsDir = DEFAULT_DOCS_DIR,
                aggregatedBy = null,
            )

            is DocsAggregationResult.Failed -> DocsTreeSelection.Failure(aggregation.message)
        }
    }
}

/**
 * Выбранная платформа документации и, если она есть, соответствующая целевая платформа клиента.
 */
internal sealed interface PlatformSelection {
    data class Selected(
        val documentation: DocumentationPlatform,
        val target: TargetPlatform?,
    ) : PlatformSelection

    data class Failure(
        val message: String,
    ) : PlatformSelection
}

/**
 * Выбранное дерево документации и toolchain, который его собрал на этом запуске.
 */
internal sealed interface DocsTreeSelection {
    data class Selected(
        val docsDir: String,
        val aggregatedBy: String?,
    ) : DocsTreeSelection

    data class Failure(
        val message: String,
    ) : DocsTreeSelection
}
