package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.Capability
import com.dsbuilder.frontend.core.platform.PlatformCapabilityRunner
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
import com.dsbuilder.frontend.core.platform.PlatformRunCommand
import com.dsbuilder.frontend.core.platform.PlatformRunResult
import com.dsbuilder.frontend.feature.docs.application.DocsAggregationResult
import com.dsbuilder.frontend.feature.docs.application.DocsPlatformAggregator

/** Куда платформенный инструмент кладёт дерево документации относительно `.sdds`. */
private const val DOCS_TREE_RELATIVE_PATH = "temp/docs"

/**
 * Платформенный шаг документации через делегат платформы.
 *
 * Реестр опрашивается до запуска: платформа без делегата — не ошибка, а отсутствие шага,
 * иначе сборки, где дерево готовит внешний инструмент, перестали бы работать.
 */
internal class PlatformDelegateDocsAggregator(
    private val registry: PlatformDelegateRegistry,
    private val platformCapabilityRunner: PlatformCapabilityRunner,
) : DocsPlatformAggregator {
    override fun aggregate(platform: TargetPlatform, toolOverride: String?): DocsAggregationResult {
        val delegate = registry.forPlatform(platform)
        if (delegate == null || Capability.DOCS_AGGREGATE !in delegate.capabilities) {
            return DocsAggregationResult.Skipped
        }

        val result = platformCapabilityRunner.execute(
            PlatformRunCommand(
                capability = Capability.DOCS_AGGREGATE,
                platform = platform,
                toolOverride = toolOverride,
            ),
        )

        return when (result) {
            is PlatformRunResult.Completed -> DocsAggregationResult.Aggregated(
                docsDir = "${result.plan.workspace.sddsDir}/$DOCS_TREE_RELATIVE_PATH",
                toolchain = result.plan.toolchain.value,
            )

            is PlatformRunResult.Failed -> DocsAggregationResult.Failed(result.message)
        }
    }
}
