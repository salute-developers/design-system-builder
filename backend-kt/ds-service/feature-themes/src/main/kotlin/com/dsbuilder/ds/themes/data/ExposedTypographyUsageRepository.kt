package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.application.typography.TypographyUsageRepository
import com.dsbuilder.ds.themes.domain.typography.ComponentPropertyReference
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/**
 * Значения свойств компонентов дизайн-системы, похожие на ссылку на стиль типографии: текст значения вариаций и
 * инвариантов или имя токена типографии из `token_id`.
 */
class ExposedTypographyUsageRepository : TypographyUsageRepository {
    override suspend fun references(designSystemId: UUID): List<ComponentPropertyReference> {
        val id = "'$designSystemId'::uuid"
        val sql = """
            SELECT c.name AS component, CASE WHEN v.token_id IS NULL THEN v.value ELSE t.name END AS reference
              FROM variation_property_values v
              JOIN styles st ON st.id = v.style_id
              JOIN variations vr ON vr.id = st.variation_id
              JOIN components c ON c.id = vr.component_id
              LEFT JOIN tokens t ON t.id = v.token_id AND t.type = 'typography'
             WHERE st.design_system_id = $id
               AND (v.token_id IS NOT NULL OR v.value ~ '$REFERENCE')
            UNION ALL
            SELECT c.name AS component, CASE WHEN v.token_id IS NULL THEN v.value ELSE t.name END AS reference
              FROM invariant_property_values v
              JOIN components c ON c.id = v.component_id
              LEFT JOIN tokens t ON t.id = v.token_id AND t.type = 'typography'
             WHERE v.design_system_id = $id
               AND (v.token_id IS NOT NULL OR v.value ~ '$REFERENCE')
        """.trimIndent()
        return TransactionManager.current().exec(sql, explicitStatementType = StatementType.SELECT) { rows ->
            buildList {
                while (rows.next()) {
                    val reference = rows.getString("reference") ?: continue
                    add(ComponentPropertyReference(rows.getString("component"), reference))
                }
            }
        }.orEmpty()
    }

    private companion object {
        /** Предварительный отбор текста значений; точный разбор — в домене. */
        const val REFERENCE = """^(screen-[sml]\.)?[a-z]+\.[a-z0-9]+\.(normal|medium|bold)$"""
    }
}
