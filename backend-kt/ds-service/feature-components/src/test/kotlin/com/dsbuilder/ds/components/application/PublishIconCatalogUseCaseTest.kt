@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.components.domain.IconAsset
import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import com.dsbuilder.ds.components.domain.IconEntry
import com.dsbuilder.ds.components.domain.IconSize
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import kotlinx.coroutines.runBlocking
import java.time.Duration
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** Загрузка каталога иконок на фейках: права, проверки, различия, защита, откат и очистка. */
class PublishIconCatalogUseCaseTest {
    private val catalog = InMemoryCatalog()
    private val storage = InMemoryIconStorage()
    private val used = linkedMapOf<String, Int>()

    private fun useCase(
        storage: IconAssetStorage = this.storage,
        transactions: TransactionRunner = Transactions(catalog),
        keepLoads: Int = 3,
    ) = PublishIconCatalogUseCase(
        transactions,
        storage,
        catalog,
        object : IconUsageReader {
            override suspend fun usedValues() = used.toMap()
        },
        IconCatalogSettings("https://s3.example.test/p", keepLoads, Duration.ofHours(1)),
    )

    private fun svg(variant: String = "") = """<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0$variant"/></svg>"""

    private fun icon(
        name: String,
        sizes: Set<IconSize> = setOf(IconSize.S16, IconSize.S24),
        category: String? = null,
        aliases: List<String> = emptyList(),
        variant: String = "",
    ) = IconUpload(name, category, aliases, sizes.associateWith { svg(variant) })

    private fun command(
        vararg icons: IconUpload,
        dryRun: Boolean = false,
        allowRemovingUsed: Boolean = false,
        version: String = "1.0.0",
    ) = PublishIconCatalog("@salutejs/sdds-icons", version, icons.toList(), dryRun, allowRemovingUsed)

    private suspend fun publish(command: PublishIconCatalog, context: DsRequestContext = PUBLISHER) =
        useCase().execute(context, command)

    private suspend fun success(command: PublishIconCatalog) =
        assertIs<DsResult.Success<PublishIconCatalogResult>>(publish(command)).value

    private fun failure(result: DsResult<*>) = assertIs<DsResult.Failure>(result).error

    @Test
    fun `without a configured storage the upload is unavailable`() = runBlocking<Unit> {
        val result = useCase(
            storage = InMemoryIconStorage(configured = false),
        ).execute(PUBLISHER, command(icon("AddOutline")))
        assertEquals(DsFailure.DependencyUnavailable("icon-storage"), failure(result))
    }

    @Test
    fun `invalid bodies are rejected without changes`() = runBlocking<Unit> {
        val bad = listOf(
            command(),
            command(icon("AddOutline"), icon("AddOutline")),
            command(icon("addOutline")),
            command(IconUpload("AddOutline", null, emptyList(), emptyMap())),
            command(IconUpload("AddOutline", "x".repeat(101), emptyList(), mapOf(IconSize.S16 to svg()))),
            command(IconUpload("AddOutline", null, List(41) { "a$it" }, mapOf(IconSize.S16 to svg()))),
            command(IconUpload("AddOutline", null, emptyList(), mapOf(IconSize.S16 to ""))),
            command(
                IconUpload(
                    "AddOutline",
                    null,
                    emptyList(),
                    mapOf(
                        IconSize.S16 to "<svg xmlns=\"http://www.w3.org/2000/svg\">" + "a".repeat(65 * 1024) + "</svg>",
                    ),
                ),
            ),
        )
        bad.forEach { assertEquals("invalid_body", assertIs<DsFailure.InvalidRequest>(failure(publish(it))).code) }
        assertTrue(catalog.entries().isEmpty())
        assertTrue(storage.files.isEmpty())
    }

    @Test
    fun `unsafe svg and legacy key collisions are named`() = runBlocking<Unit> {
        val unsafe =
            IconUpload(
                "AddOutline",
                null,
                emptyList(),
                mapOf(IconSize.S16 to "<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>"),
            )
        val error = assertIs<DsFailure.InvalidRequest>(failure(publish(command(unsafe))))
        assertEquals("unsafe_svg", error.code)
        assertEquals("AddOutline", error.details["name"])
        // Different names that split into the same words: AB and Ab.
        val collision =
            assertIs<DsFailure.InvalidRequest>(failure(publish(command(icon("ABOutline"), icon("AbOutline")))))
        assertEquals("legacy_key_collision", collision.code)
        assertTrue(storage.files.isEmpty())
    }

    @Test
    fun `a dry run reports the differences and changes nothing`() = runBlocking<Unit> {
        val result = success(command(icon("AddOutline"), dryRun = true))
        assertEquals(IconPublishOutcome.PUBLISHED, result.outcome)
        assertTrue(result.dryRun)
        assertEquals(1, result.diff.added)
        assertTrue(catalog.entries().isEmpty())
        assertTrue(storage.files.isEmpty())
    }

    @Test
    fun `a new catalog is uploaded and then activated`() = runBlocking<Unit> {
        val result = success(command(icon("AddOutline", category = "Actions", aliases = listOf("add", "добавить"))))
        assertEquals(IconPublishOutcome.PUBLISHED, result.outcome)
        assertEquals(2, storage.files.size)
        assertTrue(storage.files.keys.all { it.startsWith("${result.loadId}/") })
        assertTrue(storage.files.containsKey("${result.loadId}/24/AddOutline.svg"))
        val stored = catalog.entries().single()
        assertEquals("add.outline", stored.legacyKey)
        assertEquals("Actions", stored.category)
        assertEquals(listOf("add", "добавить"), stored.aliases)
        assertEquals(result.loadId, catalog.active()?.loadId?.value)
        assertEquals("1.0.0", catalog.active()?.packageVersion)
    }

    @Test
    fun `the same content is unchanged whatever the package version`() = runBlocking<Unit> {
        val first = success(command(icon("AddOutline")))
        val again = success(command(icon("AddOutline"), version = "2.0.0"))
        assertEquals(IconPublishOutcome.UNCHANGED, again.outcome)
        assertEquals(first.loadId, again.loadId)
        assertEquals("1.0.0", catalog.active()?.packageVersion)
        assertEquals(2, storage.files.size)
    }

    @Test
    fun `a changed category alone is a change and a new load`() = runBlocking<Unit> {
        val first = success(command(icon("AddOutline", category = "A")))
        val second = success(command(icon("AddOutline", category = "B")))
        assertEquals(IconPublishOutcome.PUBLISHED, second.outcome)
        assertTrue(first.loadId != second.loadId)
        assertEquals(listOf("AddOutline"), second.diff.changedNames)
        assertEquals(1, second.diff.changed)
    }

    @Test
    fun `returning to a stored load activates it without uploading again`() = runBlocking<Unit> {
        val first = success(command(icon("AddOutline")))
        success(command(icon("AddOutline"), icon("AddFill")))
        storage.puts = 0
        val back = success(command(icon("AddOutline")))
        assertEquals(IconPublishOutcome.ACTIVATED, back.outcome)
        assertEquals(first.loadId, back.loadId)
        assertEquals(0, storage.puts)
        assertEquals(first.loadId, catalog.active()?.loadId?.value)
        assertEquals(1, catalog.entries().size)
    }

    @Test
    fun `removing a used icon or size is refused unless allowed`() = runBlocking<Unit> {
        success(command(icon("DisclosureDownFill"), icon("AddOutline")))
        used["disclosure.down.fill.16"] = 4
        used["add.outline.24"] = 1
        val shrink = command(icon("DisclosureDownFill", sizes = setOf(IconSize.S24)), icon("AddOutline"))
        val conflict = assertIs<DsFailure.Conflict>(failure(publish(shrink)))
        assertEquals("icons_in_use", conflict.code)
        assertTrue("DisclosureDownFill" in conflict.message.orEmpty())
        assertEquals(
            setOf(IconSize.S16, IconSize.S24),
            catalog.entries().first { it.name == "DisclosureDownFill" }.sizes,
        )

        val dry = success(shrink.copy(dryRun = true))
        assertEquals(listOf(RemovedIconInUse("DisclosureDownFill", listOf(16), 4)), dry.removedInUse)

        val allowed = success(shrink.copy(allowRemovingUsed = true))
        assertEquals(IconPublishOutcome.PUBLISHED, allowed.outcome)
        assertEquals(setOf(IconSize.S24), catalog.entries().first { it.name == "DisclosureDownFill" }.sizes)
    }

    @Test
    fun `reconciliation lists values that do not resolve and leaves them untouched`() = runBlocking<Unit> {
        used["add.outline.24"] = 2
        used["legacy.star.24"] = 1
        used["chevron.left.24"] = 3
        used["add.24"] = 1
        val result = success(command(icon("AddOutline"), dryRun = true))
        assertEquals(2, result.reconciliation.resolved)
        assertEquals(2, result.reconciliation.unresolved)
        assertEquals(listOf("chevron.left.24", "legacy.star.24"), result.reconciliation.unresolvedValues)
        assertTrue(result.removedInUse.isEmpty())
    }

    @Test
    fun `a value without a style is protected through its outline icon`() = runBlocking<Unit> {
        success(command(icon("CloseOutline")))
        used["close.24"] = 5
        val result = success(command(icon("PlusOutline"), dryRun = true))
        assertEquals(listOf(RemovedIconInUse("CloseOutline", listOf(24), 5)), result.removedInUse)
    }

    @Test
    fun `the lists of names are truncated at two hundred`() = runBlocking<Unit> {
        val many = (0 until 250).map { icon("Icon${it}Outline", sizes = setOf(IconSize.S24)) }
        val result = success(command(*many.toTypedArray(), dryRun = true))
        assertEquals(250, result.diff.added)
        assertEquals(200, result.diff.addedNames.size)
        assertTrue(result.diff.truncated)
    }

    @Test
    fun `a failed upload or transaction keeps the previous catalog active`() = runBlocking<Unit> {
        val first = success(command(icon("AddOutline")))
        val failingStorage = InMemoryIconStorage(failPuts = true)
        val uploadFailure = useCase(
            storage = failingStorage,
        ).execute(PUBLISHER, command(icon("AddOutline"), icon("AddFill")))
        assertEquals(DsFailure.DependencyUnavailable("icon-storage"), failure(uploadFailure))
        assertEquals(first.loadId, catalog.active()?.loadId?.value)
        assertEquals(1, catalog.entries().size)

        catalog.failReplace = true
        val before = storage.files.keys.toSet()
        runCatching { publish(command(icon("AddOutline"), icon("AddFill"))) }
        assertEquals(first.loadId, catalog.active()?.loadId?.value)
        assertTrue(storage.files.keys.containsAll(before))
    }

    @Test
    fun `old loads and expired orphans are cleaned and a cleanup failure is ignored`() = runBlocking<Unit> {
        val loads = (1..5).map { index -> success(command(icon("Icon${index}Outline"))).loadId }
        // keepLoads = 3: the active load plus three previous ones stay.
        assertEquals(
            setOf(loads[1], loads[2], loads[3], loads[4]),
            catalog.loadsByRecency().map { it.loadId.value }.toSet(),
        )
        assertTrue(storage.files.keys.none { it.startsWith("${loads[0]}/") })

        storage.orphans["ffffffffffff"] = Instant.now().minus(Duration.ofHours(5))
        storage.orphans["eeeeeeeeeeee"] = Instant.now()
        success(command(icon("Icon6Outline")))
        assertTrue("ffffffffffff" in storage.deleted)
        assertTrue("eeeeeeeeeeee" !in storage.deleted)

        storage.failDeletes = true
        val result = success(command(icon("Icon7Outline")))
        assertEquals(IconPublishOutcome.PUBLISHED, result.outcome)
    }

    /** Откатывает каталог при отказе, как транзакция БД. */
    private class Transactions(private val catalog: InMemoryCatalog) : TransactionRunner {
        override suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T> {
            val snapshot = catalog.snapshot()
            val result = block()
            if (result is DsResult.Failure) catalog.restore(snapshot)
            return result
        }
        override suspend fun <T> rollback(context: DsRequestContext, block: suspend () -> DsResult<T>) = block()
        override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
    }

    private class InMemoryIconStorage(
        override val configured: Boolean = true,
        private val failPuts: Boolean = false,
    ) : IconAssetStorage {
        val files = java.util.concurrent.ConcurrentHashMap<String, String>()
        val orphans = linkedMapOf<String, Instant>()
        val deleted = mutableListOf<String>()
        private val counter = java.util.concurrent.atomic.AtomicInteger()
        var puts: Int
            get() = counter.get()
            set(value) = counter.set(value)
        var failDeletes = false

        override suspend fun put(loadId: IconCatalogLoadId, asset: IconAsset) {
            check(!failPuts) { "storage down" }
            counter.incrementAndGet()
            files["${loadId.value}/${asset.size.px}/${asset.name}.svg"] = asset.svg
        }

        override suspend fun listLoads() =
            files.keys.map {
                it.substringBefore('/')
            }.distinct().map { StoredIconLoad(it, Instant.now().minus(Duration.ofHours(2))) } +
                orphans.map { (id, at) -> StoredIconLoad(id, at) }

        override suspend fun deleteLoad(loadId: String) {
            check(!failDeletes) { "delete failed" }
            deleted += loadId
            files.keys.removeAll { it.startsWith("$loadId/") }
            orphans.remove(loadId)
        }
    }

    private class InMemoryCatalog : IconCatalogRepository {
        fun active() = loads.values.firstOrNull { it.active }

        fun snapshot() = entries to LinkedHashMap(loads)

        fun restore(snapshot: Pair<List<IconEntry>, Map<String, IconCatalogLoad>>) {
            entries = snapshot.first
            loads.clear()
            loads.putAll(snapshot.second)
        }

        private var entries = listOf<IconEntry>()
        private val loads = linkedMapOf<String, IconCatalogLoad>()
        var failReplace = false
        private var clock = 0L

        override suspend fun lockPublications() = Unit
        override suspend fun entries() = entries
        override suspend fun loadsByRecency() = loads.values.sortedByDescending { it.loadedAt }

        override suspend fun replaceActive(entries: List<IconEntry>, load: NewIconCatalogLoad) {
            check(!failReplace) { "db down" }
            this.entries = entries
            loads.replaceAll { _, value -> value.copy(active = false) }
            loads[load.loadId.value] = IconCatalogLoad(
                load.loadId, load.packageName, load.packageVersion, entries.size, load.loadedBy,
                Instant.EPOCH.plusSeconds(clock++), active = true,
            )
        }

        override suspend fun deleteLoad(loadId: IconCatalogLoadId) {
            if (loads[loadId.value]?.active == false) loads.remove(loadId.value)
        }
    }

    private companion object {
        val PUBLISHER = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "publisher", "global", composePreviewPublisher = true),
            "correlation-1",
        )
        val ADMIN = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "admin", "global", systemAdmin = true),
            "correlation-2",
        )
        val MEMBER = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "member", "project-1", "owner"),
            "correlation-3",
        )
    }
}
