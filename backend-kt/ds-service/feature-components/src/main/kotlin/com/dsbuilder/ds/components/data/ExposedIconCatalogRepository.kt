package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.IconCatalogLoad
import com.dsbuilder.ds.components.application.IconCatalogRepository
import com.dsbuilder.ds.components.application.NewIconCatalogLoad
import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import com.dsbuilder.ds.components.domain.IconEntry
import com.dsbuilder.ds.components.domain.IconSize
import com.dsbuilder.ds.components.domain.IconStyle
import org.jetbrains.exposed.v1.core.LongColumnType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.update
import org.jetbrains.exposed.v1.jdbc.upsert
import java.time.Instant

/** Каталог и журнал загрузок иконок поверх Exposed; работает в транзакции вызывающего кода. */
internal class ExposedIconCatalogRepository : IconCatalogRepository {
    override suspend fun lockPublications() {
        // Каждое чтение после ожидания блокировки должно видеть коммит победителя.
        TransactionManager.current().exec("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
        TransactionManager.current().exec(
            "SELECT pg_advisory_xact_lock(?)",
            listOf(LongColumnType() to PUBLICATION_LOCK_KEY),
        )
    }

    override suspend fun entries(): List<IconEntry> =
        IconsTable.selectAll().orderBy(IconsTable.name to SortOrder.ASC).map { it.toEntry() }

    override suspend fun loadsByRecency(): List<IconCatalogLoad> =
        IconCatalogLoadsTable.selectAll()
            .orderBy(IconCatalogLoadsTable.loadedAt to SortOrder.DESC, IconCatalogLoadsTable.loadId to SortOrder.DESC)
            .map { it.toLoad() }

    override suspend fun replaceActive(entries: List<IconEntry>, load: NewIconCatalogLoad) {
        IconsTable.deleteAll()
        IconsTable.batchInsert(entries, shouldReturnGeneratedValues = false) { entry ->
            this[IconsTable.name] = entry.name
            this[IconsTable.legacyKey] = entry.legacyKey
            this[IconsTable.style] = entry.style.wire
            this[IconsTable.category] = entry.category
            this[IconsTable.aliases] = entry.aliases
            this[IconsTable.sizes] = entry.sizes.map(IconSize::px).sorted()
            this[IconsTable.contentHash] = entry.contentHash
        }
        IconCatalogLoadsTable.update({ IconCatalogLoadsTable.active eq true }) { it[active] = false }
        IconCatalogLoadsTable.upsert {
            it[loadId] = load.loadId.value
            it[packageName] = load.packageName
            it[packageVersion] = load.packageVersion
            it[iconCount] = entries.size
            it[loadedBy] = load.loadedBy
            it[loadedAt] = Instant.now()
            it[active] = true
        }
    }

    override suspend fun deleteLoad(loadId: IconCatalogLoadId) {
        IconCatalogLoadsTable.deleteWhere { (IconCatalogLoadsTable.loadId eq loadId.value) and (active eq false) }
    }

    private fun ResultRow.toLoad() = IconCatalogLoad(
        loadId = IconCatalogLoadId(this[IconCatalogLoadsTable.loadId]),
        packageName = this[IconCatalogLoadsTable.packageName],
        packageVersion = this[IconCatalogLoadsTable.packageVersion],
        iconCount = this[IconCatalogLoadsTable.iconCount],
        loadedBy = this[IconCatalogLoadsTable.loadedBy],
        loadedAt = this[IconCatalogLoadsTable.loadedAt],
        active = this[IconCatalogLoadsTable.active],
    )

    private fun ResultRow.toEntry() = IconEntry(
        name = this[IconsTable.name],
        legacyKey = this[IconsTable.legacyKey],
        style = requireNotNull(IconStyle.fromWire(this[IconsTable.style])),
        sizes = this[IconsTable.sizes].mapNotNull(IconSize::fromPx).toSet(),
        category = this[IconsTable.category],
        aliases = this[IconsTable.aliases],
        contentHash = this[IconsTable.contentHash],
    )

    private companion object {
        /** Ключ advisory-блокировки каталога иконок (ASCII `iconcat`). */
        const val PUBLICATION_LOCK_KEY = 0x69636F6E63617400L
    }
}
