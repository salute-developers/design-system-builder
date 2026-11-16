package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.themes.application.TenantTokenValueCopier
import com.dsbuilder.ds.themes.domain.Tenant
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll

/**
 * Копия значений темы тем же пакетным писателем, что и начальные значения новой темы: значения копии становятся её
 * базовыми значениями создания, поэтому журнал черновика не показывает изменений значений копии.
 */
internal class ExposedTenantTokenValueCopier : TenantTokenValueCopier {
    override suspend fun copy(source: Tenant, target: Tenant) {
        check(source.designSystemId == target.designSystemId) { "Theme copy stays in its design system" }
        check(!ThemeTokenValuesTable.selectAll().where { ThemeTokenValuesTable.tenantId eq target.id }.limit(1).any()) {
            "Theme copy is written only into a theme without values"
        }
        val draft = themeDraft(target.designSystemId) ?: error("Active draft is missing")
        val values = currentThemeTokenValueRows(source.designSystemId, tenantIds = setOf(source.id)).associate { row ->
            InitialValueKey(
                row[ThemeTokenValuesTable.tokenId],
                row[ThemeTokenValuesTable.platform],
                row[ThemeTokenValuesTable.mode],
            ) to InitialValuePayload(
                row[ThemeTokenValueRevisionsTable.paletteId],
                row[ThemeTokenValueRevisionsTable.value],
                row[ThemeTokenValueRevisionsTable.overridden],
            )
        }
        SubjectMutationPaths.withoutBaseComparison {
            insertInitialTenantValues(
                target.id,
                target.designSystemId,
                draft[ThemeVersionBoundariesTable.id],
                draft[ThemeVersionBoundariesTable.sequenceNumber],
                values,
            )
        }
    }
}
