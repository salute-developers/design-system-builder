package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.CoreContextResolver
import com.dsbuilder.ds.core.application.ResolvedCoreRelease
import com.dsbuilder.ds.core.domain.CoreReleaseRef
import org.jetbrains.exposed.v1.core.Key
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Читает один согласованный набор в текущей транзакции; старой границе latest не подставляется. */
class ExposedCoreContextResolver : CoreContextResolver {
    override suspend fun resolve(versionId: UUID?): List<ResolvedCoreRelease> {
        val binding = """
            SELECT binding.release_id, CASE WHEN boundary.status = 'draft' THEN binding.selection_mode
                ELSE 'pinned' END AS selection_mode FROM design_system_version_core_releases binding
            JOIN design_system_versions boundary ON boundary.id = binding.version_id
            WHERE boundary.design_system_id = NULLIF(current_setting('ds.design_system_id', true), '')::uuid
              AND ds_request_matches_design_system(boundary.design_system_id)
              AND ${if (versionId == null) "boundary.status = 'draft'" else "boundary.id = ?"}
        """.trimIndent()
        return TransactionManager.current().exec(
            "SELECT r.id, r.library_id, r.platform, r.version, r.meta_sha256, r.provenance, " +
                "r.channel, b.selection_mode " +
                "FROM core_releases r JOIN ($binding) b ON b.release_id = r.id ORDER BY r.platform",
            if (versionId == null) emptyList() else listOf(UUIDColumnType() to versionId),
        ) { rows ->
            buildList {
                while (rows.next()) add(
                    ResolvedCoreRelease(
                        rows.getObject("id", UUID::class.java),
                        CoreReleaseRef(
                            rows.getString("library_id"),
                            rows.getString("platform"),
                            rows.getString("version"),
                        ),
                        rows.getString("meta_sha256"),
                        rows.getString("provenance"),
                        rows.getString("channel"),
                        rows.getString("selection_mode"),
                    ),
                )
            }
        }.orEmpty()
    }
}

internal val expectedCoreSelectionRevision = Key<Long>()
internal class CoreSelectionStaleException : RuntimeException()

/** Блокирует только выбранную ДС: границу, затем её привязки по платформам. */
fun lockDraftCoreSelection(designSystemId: UUID? = null, exclusive: Boolean = false) {
    val tx = TransactionManager.current()
    val system = designSystemId ?: tx.exec("SELECT NULLIF(current_setting('ds.design_system_id', true), '')") {
            rows ->
        if (rows.next()) rows.getString(1)?.let(UUID::fromString) else null
    } ?: return
    requireRequestDesignSystemMutable()
    if (exclusive) {
        lockDesignSystemPublication(system)
    } else {
        tx.exec(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended(CAST(? AS text), 684313))",
            listOf(UUIDColumnType() to system),
        )
    }
    val rowLock = if (exclusive) " FOR UPDATE" else " FOR KEY SHARE"
    tx.exec(
        "SELECT id FROM design_system_versions WHERE design_system_id = ? AND status = 'draft'" + rowLock,
        listOf(UUIDColumnType() to system),
    )
    tx.getUserData(expectedCoreSelectionRevision)?.let { expected ->
        val actual = tx.exec(
            "SELECT core_selection_revision FROM design_system_versions " +
                "WHERE design_system_id = ? AND status = 'draft'",
            listOf(UUIDColumnType() to system),
        ) { rows -> if (rows.next()) rows.getLong(1) else null }
        if (actual != expected) throw CoreSelectionStaleException()
    }
    tx.exec(
        "SELECT binding.release_id FROM design_system_version_core_releases binding " +
            "JOIN design_system_versions boundary ON boundary.id = binding.version_id " +
            "WHERE boundary.design_system_id = ? AND boundary.status = 'draft' " +
            "ORDER BY binding.platform" + if (exclusive) " FOR UPDATE OF binding" else " FOR KEY SHARE OF binding",
        listOf(UUIDColumnType() to system),
    )
}

/** Закрепляет API и совместимый preview в существующей границе без создания версии или записи журнала. */
fun bindVersionCoreReleases(versionId: UUID) {
    val tx = TransactionManager.current()
    val args = listOf(UUIDColumnType() to versionId)
    tx.exec(
        """
        INSERT INTO design_system_version_preview_builds(version_id, platform, release_id, build_id)
        SELECT binding.version_id, binding.platform, binding.release_id,
            (SELECT b.build_id FROM core_release_preview_builds b WHERE b.release_id = binding.release_id
             ORDER BY b.registered_at DESC, b.build_id DESC LIMIT 1)
        FROM design_system_version_core_releases binding WHERE binding.version_id = ?
        """.trimIndent(),
        args,
    )
}

/** Читает отдельную ревизию выбора после разрешения предметной границы. */
fun coreSelectionRevision(versionId: UUID): Long = TransactionManager.current().exec(
    "SELECT core_selection_revision FROM design_system_versions WHERE id = ?",
    listOf(UUIDColumnType() to versionId),
) { rows -> if (rows.next()) rows.getLong(1) else 0L } ?: 0L

/** Проверенный контекст чтения ДС отличает её Core-каталог от глобального служебного каталога. */
fun hasDesignSystemCoreScope(): Boolean = TransactionManager.current().exec(
    "SELECT NULLIF(current_setting('ds.design_system_id', true), '') IS NOT NULL",
) { rows -> rows.next() && rows.getBoolean(1) } == true
