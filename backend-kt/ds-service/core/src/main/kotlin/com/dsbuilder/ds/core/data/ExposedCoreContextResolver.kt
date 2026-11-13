package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.CoreContextResolver
import com.dsbuilder.ds.core.application.ResolvedCoreRelease
import com.dsbuilder.ds.core.domain.CoreReleaseRef
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Читает один согласованный набор в текущей транзакции; старой границе latest не подставляется. */
class ExposedCoreContextResolver : CoreContextResolver {
    override suspend fun resolve(versionId: UUID?): List<ResolvedCoreRelease> {
        val binding = if (versionId == null) {
            "SELECT release_id FROM core_current_releases"
        } else {
            "SELECT release_id FROM design_system_version_core_releases WHERE version_id = ?"
        }
        return TransactionManager.current().exec(
            "SELECT r.* FROM core_releases r JOIN ($binding) b ON b.release_id = r.id ORDER BY r.platform",
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
                    ),
                )
            }
        }.orEmpty()
    }
}

/** Единый порядок блокировок публикации и обычных записей относительно импорта. */
fun lockCurrentCoreReleases() {
    TransactionManager.current().exec("SELECT release_id FROM core_current_releases ORDER BY platform FOR SHARE") {
            rows ->
        while (rows.next()) Unit
    }
}

/** Закрепляет API и совместимый preview в существующей границе без создания версии или записи журнала. */
fun bindVersionCoreReleases(versionId: UUID) {
    val tx = TransactionManager.current()
    val args = listOf(UUIDColumnType() to versionId)
    tx.exec(
        "INSERT INTO design_system_version_core_releases(version_id, platform, release_id) " +
            "SELECT ?, platform, release_id FROM core_current_releases",
        args,
    )
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
