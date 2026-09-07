package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.feature.docs.domain.DocsValidationEngine
import com.dsbuilder.frontend.feature.docs.domain.Manifest
import com.dsbuilder.frontend.feature.docs.domain.ResolvedDocs
import com.dsbuilder.frontend.feature.docs.domain.Structure
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DocsGeneratePlatformStepTest {
    @Test
    fun platformStepBuildsTheTreeWhenDocsDirIsNotGiven() {
        val aggregator = RecordingAggregator(
            DocsAggregationResult.Aggregated(docsDir = "/repo/.sdds/temp/docs", toolchain = "ios"),
        )
        val useCase = useCase(aggregator, configuredPlatforms = listOf(TargetPlatform.SWIFT_UI))

        val result = useCase.execute(DocsGenerateCommand(outputGzipPath = "/out/docs.tar.gz"))

        val success = assertIs<DocsGenerateResult.Success>(result)
        assertEquals("/repo/.sdds/temp/docs", success.docsDir)
        assertEquals("ios", success.aggregatedBy)
        assertEquals(listOf(TargetPlatform.SWIFT_UI), aggregator.requests.map { it.first })
    }

    @Test
    fun explicitDocsDirKeepsTheReadyTreeAndSkipsThePlatformStep() {
        val aggregator = RecordingAggregator(DocsAggregationResult.Skipped)
        val useCase = useCase(aggregator, configuredPlatforms = listOf(TargetPlatform.SWIFT_UI))

        val result = useCase.execute(
            DocsGenerateCommand(docsDir = "/prepared/docs", outputGzipPath = "/out/docs.tar.gz"),
        )

        val success = assertIs<DocsGenerateResult.Success>(result)
        assertEquals("/prepared/docs", success.docsDir)
        assertNull(success.aggregatedBy)
        assertTrue(aggregator.requests.isEmpty())
    }

    @Test
    fun noAggregateFlagKeepsTheDefaultTree() {
        val aggregator = RecordingAggregator(DocsAggregationResult.Skipped)
        val useCase = useCase(aggregator, configuredPlatforms = listOf(TargetPlatform.SWIFT_UI))

        val result = useCase.execute(
            DocsGenerateCommand(outputGzipPath = "/out/docs.tar.gz", aggregate = false),
        )

        assertEquals(".sdds/temp/docs", assertIs<DocsGenerateResult.Success>(result).docsDir)
        assertTrue(aggregator.requests.isEmpty())
    }

    @Test
    fun platformWithoutToolchainFallsBackToTheDefaultTree() {
        val aggregator = RecordingAggregator(DocsAggregationResult.Skipped)
        val useCase = useCase(aggregator, configuredPlatforms = emptyList())

        val result = useCase.execute(DocsGenerateCommand(outputGzipPath = "/out/docs.tar.gz", platform = "compose"))

        val success = assertIs<DocsGenerateResult.Success>(result)
        assertEquals(".sdds/temp/docs", success.docsDir)
        assertNull(success.aggregatedBy)
        assertEquals(listOf(TargetPlatform.COMPOSE), aggregator.requests.map { it.first })
    }

    @Test
    fun failedPlatformStepStopsBeforeBuildingThePackage() {
        val aggregator = RecordingAggregator(DocsAggregationResult.Failed("Toolchain 'ios' failed with exit code 1."))
        val fileSystem = RecordingDocsFileSystem()
        val useCase = useCase(aggregator, listOf(TargetPlatform.SWIFT_UI), fileSystem)

        val result = useCase.execute(DocsGenerateCommand(outputGzipPath = "/out/docs.tar.gz"))

        assertEquals("Toolchain 'ios' failed with exit code 1.", assertIs<DocsGenerateResult.Failed>(result).message)
        assertTrue(fileSystem.writes.isEmpty())
        assertTrue(!fileSystem.archiveCreated)
    }

    @Test
    fun platformIsTakenFromProjectConfigWhenTheOptionIsAbsent() {
        val aggregator = RecordingAggregator(
            DocsAggregationResult.Aggregated(docsDir = "/repo/.sdds/temp/docs", toolchain = "android"),
        )
        val useCase = useCase(aggregator, configuredPlatforms = listOf(TargetPlatform.COMPOSE))

        useCase.execute(DocsGenerateCommand(outputGzipPath = "/out/docs.tar.gz", toolOverride = "/tools/gradlew"))

        assertEquals(TargetPlatform.COMPOSE to "/tools/gradlew", aggregator.requests.single())
    }

    /**
     * Историческое умолчание команды: до делегатов `docs generate` без `--platform` собирал
     * compose-пакет, и проекты, не объявившие платформу, должны продолжать работать так же.
     */
    @Test
    fun projectWithoutDeclaredPlatformKeepsTheHistoricalComposeDefault() {
        val aggregator = RecordingAggregator(DocsAggregationResult.Skipped)
        val useCase = useCase(aggregator, configuredPlatforms = emptyList())

        val result = useCase.execute(DocsGenerateCommand(outputGzipPath = "/out/docs.tar.gz"))

        assertEquals(".sdds/temp/docs", assertIs<DocsGenerateResult.Success>(result).docsDir)
        assertEquals(listOf(TargetPlatform.COMPOSE), aggregator.requests.map { it.first })
    }

    @Test
    fun severalConfiguredPlatformsRequireAnExplicitChoice() {
        val useCase = useCase(
            RecordingAggregator(DocsAggregationResult.Skipped),
            configuredPlatforms = listOf(TargetPlatform.SWIFT_UI, TargetPlatform.COMPOSE),
        )

        val result = useCase.execute(DocsGenerateCommand(outputGzipPath = "/out/docs.tar.gz"))

        val message = assertIs<DocsGenerateResult.Failed>(result).message
        assertTrue(message.contains("swiftui") && message.contains("compose"), message)
    }

    @Test
    fun designPlatformHasNoToolchainAndUsesTheReadyTree() {
        val aggregator = RecordingAggregator(DocsAggregationResult.Skipped)
        val useCase = useCase(aggregator, configuredPlatforms = emptyList())

        val result = useCase.execute(DocsGenerateCommand(outputGzipPath = "/out/docs.tar.gz", platform = "design"))

        assertEquals(".sdds/temp/docs", assertIs<DocsGenerateResult.Success>(result).docsDir)
        assertTrue(aggregator.requests.isEmpty())
    }

    private fun useCase(
        aggregator: DocsPlatformAggregator,
        configuredPlatforms: List<TargetPlatform>,
        fileSystem: RecordingDocsFileSystem = RecordingDocsFileSystem(),
    ) = DocsGenerateUseCase(
        structureReader = object : DocsStructureReader {
            override fun readStructure(path: String) = Structure("1.0", emptyList())
        },
        platformContextReader = DocsPlatformContextReader { null },
        projectContextReader = object : DocsProjectContextReader {
            override fun designSystemId() = "design-system"

            override fun designSystemVersion() = "0.0.0"

            override fun platforms() = configuredPlatforms
        },
        codec = object : DocsCodec {
            override fun serializeResolvedDocs(docs: ResolvedDocs) = "{}"

            override fun serializeManifest(manifest: Manifest) = "{}"
        },
        fileSystem = fileSystem,
        validationEngine = object : DocsValidationEngine {
            override fun validate(
                resolvedDocs: ResolvedDocs,
                manifest: Manifest,
                docsDir: String,
            ) = emptyList<Nothing>()
        },
        platformAggregator = aggregator,
    )
}

/**
 * Агрегатор, запоминающий запросы, чтобы проверить, когда платформенный шаг вызывается,
 * а когда его быть не должно.
 */
private class RecordingAggregator(
    private val result: DocsAggregationResult,
) : DocsPlatformAggregator {
    val requests: MutableList<Pair<TargetPlatform, String?>> = mutableListOf()

    override fun aggregate(platform: TargetPlatform, toolOverride: String?): DocsAggregationResult {
        requests += platform to toolOverride
        return result
    }
}

private class RecordingDocsFileSystem : DocsFileSystem {
    val writes: MutableList<String> = mutableListOf()
    var archiveCreated: Boolean = false
        private set

    override fun writeFile(path: String, content: String) {
        writes += path
    }

    override fun createTarGzArchive(sourceDir: String, tarGzPath: String) {
        archiveCreated = true
    }
}
