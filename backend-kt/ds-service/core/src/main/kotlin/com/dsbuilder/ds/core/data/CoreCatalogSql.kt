package com.dsbuilder.ds.core.data

/** Релизные поля системных чтений; глобальные catalog-запросы сохраняют прежний реестр. */
fun coreCatalogSql(table: String, projection: String, idColumn: String, fields: List<String>): String {
    val scoped = "NULLIF(current_setting('ds.design_system_id', true), '') IS NOT NULL"
    val (platform, ownerJoin) = if (table in setOf("components", "property_platform_params")) {
        "entity.platform" to ""
    } else {
        "core_owner.platform" to "JOIN components core_owner ON core_owner.id = entity.component_id"
    }
    val selectedFields = fields.joinToString(
        ", ",
    ) { field -> if (field == "platform") "entity.platform" else "api.$field" }
    val originalFields = fields.joinToString(", ") { "entity.$it" }
    val common = if (table == "states") " OR entity.component_id IS NULL" else ""
    val diagnosticFields = fields.joinToString(", ") { field ->
        if (field == "description") "NULL::text AS description" else "entity.$field"
    }
    val missingComponents = if (table == "components") {
        """
        UNION ALL
        SELECT entity.id, $diagnosticFields,
               COALESCE(release.created_at, entity.created_at) AS created_at,
               COALESCE(release.created_at, entity.created_at) AS updated_at
        FROM components entity LEFT JOIN core_releases release ON release.id = ds_selected_core_release(entity.platform)
        WHERE $scoped AND NOT EXISTS (
            SELECT 1 FROM core_release_components api
            WHERE api.release_id = ds_selected_core_release(entity.platform) AND api.component_id = entity.id
        ) AND EXISTS (
            SELECT 1 FROM design_system_components link
            JOIN design_system_versions boundary ON boundary.design_system_id = link.design_system_id
            JOIN design_system_component_revisions revision ON revision.design_system_component_id = link.id
              AND revision.version_sequence_number <= boundary.sequence_number
            WHERE link.component_id = entity.id
              AND link.design_system_id = NULLIF(current_setting('ds.design_system_id', true), '')::uuid
              AND ${selectedVersionBoundarySql("boundary")}
        )
        """.trimIndent()
    } else {
        ""
    }
    return """
        SELECT entity.id, $originalFields, entity.created_at, entity.updated_at FROM $table entity WHERE NOT
        ($scoped)$common
        UNION ALL
        SELECT entity.id, $selectedFields, release.created_at AS created_at, release.created_at AS updated_at
        FROM $table entity $ownerJoin
        JOIN $projection api ON api.$idColumn = entity.id
        JOIN core_releases release ON release.id = api.release_id
        WHERE $scoped AND release.id = ds_selected_core_release(release.platform)
          AND release.platform = $platform
        $missingComponents
    """.trimIndent()
}
