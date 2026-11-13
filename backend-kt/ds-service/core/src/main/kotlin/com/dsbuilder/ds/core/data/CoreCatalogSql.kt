package com.dsbuilder.ds.core.data

/** Релизные поля системных чтений; глобальные catalog-запросы сохраняют прежний реестр. */
fun coreCatalogSql(table: String, projection: String, idColumn: String, fields: List<String>): String {
    val scoped = "NULLIF(current_setting('ds.design_system_id', true), '') IS NOT NULL"
    val platform = when (table) {
        "components", "property_platform_params" -> "entity.platform"
        else -> "(SELECT platform FROM components WHERE id = entity.component_id)"
    }
    val selectedFields = fields.joinToString(
        ", ",
    ) { field -> if (field == "platform") "entity.platform" else "api.$field" }
    val originalFields = fields.joinToString(", ") { "entity.$it" }
    val common = if (table == "states") " OR entity.component_id IS NULL" else ""
    val missingComponents = if (table == "components") {
        """
        UNION ALL
        SELECT entity.id, $originalFields, entity.created_at, entity.updated_at FROM components entity
        WHERE $scoped AND NOT EXISTS (
            SELECT 1 FROM core_release_components api
            WHERE api.release_id = ds_selected_core_release(entity.platform) AND api.component_id = entity.id
        ) AND EXISTS (
            SELECT 1 FROM design_system_components link WHERE link.component_id = entity.id
              AND link.design_system_id = NULLIF(current_setting('ds.design_system_id', true), '')::uuid
        )
        """.trimIndent()
    } else {
        ""
    }
    return """
        SELECT entity.id, $originalFields, entity.created_at, entity.updated_at FROM $table entity WHERE NOT
        ($scoped)$common
        UNION ALL
        SELECT entity.id, $selectedFields, entity.created_at, entity.updated_at
        FROM $table entity JOIN $projection api ON api.$idColumn = entity.id
          AND api.release_id = ds_selected_core_release($platform)
        WHERE $scoped
        $missingComponents
    """.trimIndent()
}
