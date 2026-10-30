package com.dsbuilder.app.data

import com.dsbuilder.ds.designsystems.application.DesignSystemCatalogCounts
import com.dsbuilder.projects.feature.projects.application.port.DesignSystemCounts

/** Связывает прикладные границы без HTTP и доступа к таблицам другой подсистемы. */
class InProcessDesignSystemCounts(private val counts: DesignSystemCatalogCounts) : DesignSystemCounts {
    override suspend fun count(projectIds: List<String>): Map<String, Int> = counts.count(projectIds)
}
