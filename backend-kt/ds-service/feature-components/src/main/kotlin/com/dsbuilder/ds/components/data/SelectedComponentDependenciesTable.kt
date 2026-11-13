package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.javatime.timestamp

/** Вложенность Core и назначения ДС имеют разные источники и одну выбранную границу. */
internal object SelectedComponentDependenciesTable : ResolvedRevisionTable(
    "component_deps",
    selectedDependenciesSql(),
) {
    val id = uuid("id")
    val parentId = uuid("parent_id")
    val childId = uuid("child_id")
    val type = postgresEnum("type", "relation_type", RelationTypeDb::fromWire, RelationTypeDb::wireValue)
    val order = integer("order").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

private fun selectedDependenciesSql(): String {
    val references = resolvedRevisionSql(
        "component_style_references",
        "component_style_reference_revisions",
        "component_style_reference_id",
        listOf("id", "design_system_id", "created_at"),
        listOf(
            "invariant_property_value_id",
            "variation_property_value_id",
            "style_combination_id",
            "target_appearance_id",
        ),
    )
    val reuse = resolvedRevisionSql(
        "component_reuse_configs",
        "component_reuse_config_revisions",
        "component_reuse_config_id",
        listOf("id", "component_dep_id", "design_system_id", "created_at"),
        listOf("appearance_id", "variation_id", "style_id"),
    )
    return """
        SELECT d.* FROM component_deps d WHERE NULLIF(current_setting('ds.design_system_id', true), '') IS NULL
        UNION ALL
        SELECT d.id, api.parent_id, api.child_id, api.type, api."order", d.created_at, d.updated_at
        FROM core_release_component_dependencies api JOIN component_deps d ON d.id = api.dependency_id
        JOIN core_releases r ON r.id = api.release_id
        WHERE NULLIF(current_setting('ds.design_system_id', true), '') IS NOT NULL
          AND api.release_id = ds_selected_core_release(r.platform)
        UNION ALL
        SELECT d.* FROM component_deps d
        WHERE NULLIF(current_setting('ds.design_system_id', true), '') IS NOT NULL AND d.type = 'reuse' AND (
            EXISTS(SELECT 1 FROM ($reuse) config WHERE config.component_dep_id = d.id)
            OR EXISTS(
                SELECT 1 FROM ($references) ref
                LEFT JOIN invariant_property_values i ON i.id = ref.invariant_property_value_id
                LEFT JOIN variation_property_values v ON v.id = ref.variation_property_value_id
                LEFT JOIN style_combinations c ON c.id = ref.style_combination_id
                JOIN appearances source ON source.id = COALESCE(i.appearance_id, v.appearance_id, c.appearance_id)
                JOIN appearances target ON target.id = ref.target_appearance_id
                WHERE source.component_id = d.parent_id AND target.component_id = d.child_id
            )
        )
    """.trimIndent()
}
