package com.dsbuilder.ds.app

/** Независимое SQL-чтение активных предметных значений для проверок новых и прежних HTTP-сценариев. */
internal fun activeRevisionTestSql(sql: String): String {
    val subjects = listOf(
        Triple("tokens", "token", "name, type, display_name, description, enabled, group_id, position"),
        Triple("token_values", "token_value", "palette_id, value, overridden"),
        Triple("token_groups", "token_group", "parent_id, code, label, position"),
        Triple("tenant_palette_token_groups", "tenant_palette_token_group", "group_id"),
        Triple(
            "invariant_property_values",
            "invariant_property_value",
            "token_id, value, alpha, adjustment, position, state_set_id",
        ),
        Triple(
            "variation_property_values",
            "variation_property_value",
            "token_id, value, alpha, adjustment, position, state_set_id",
        ),
        Triple("appearances", "appearance", "name"),
    )
    val ctes = subjects.joinToString(",\n") { (table, revision, columns) ->
        val id = when (table) {
            "tenant_palette_token_groups" -> "assignment_id"
            "token_groups" -> "group_id"
            else -> "${revision}_id"
        }
        val selected = columns.split(", ").joinToString { "resolved.$it" }
        """
        $table AS (
            SELECT stable.*, $selected
            FROM public.$table stable
            JOIN public.design_system_versions boundary ON boundary.design_system_id = stable.design_system_id AND boundary.status = 'draft'
            JOIN LATERAL (
                SELECT candidate.* FROM public.${revision}_revisions candidate
                WHERE candidate.$id = stable.id AND candidate.version_sequence_number <= boundary.sequence_number
                ORDER BY candidate.version_sequence_number DESC LIMIT 1
            ) resolved ON NOT resolved.deleted
        )
        """.trimIndent()
    }
    return "WITH $ctes\n$sql"
}
