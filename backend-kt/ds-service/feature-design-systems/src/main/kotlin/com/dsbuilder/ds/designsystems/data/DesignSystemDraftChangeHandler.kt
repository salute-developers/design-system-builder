package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.data.ExposedDraftChangeHandler

/** Журнал и откат полей самой дизайн-системы. */
fun designSystemDraftChangeHandler(): DraftChangeHandler = ExposedDraftChangeHandler(
    entityType = "design-system",
    stableTable = DesignSystemsTable,
    stableId = DesignSystemsTable.id,
    stableDesignSystemId = DesignSystemsTable.id,
    revisionTable = DesignSystemRevisionTable,
    revisionEntityId = DesignSystemRevisionTable.designSystemId,
    revisionVersionId = DesignSystemRevisionTable.designSystemVersionId,
    revisionSequenceNumber = DesignSystemRevisionTable.versionSequenceNumber,
    revisionDeleted = DesignSystemRevisionTable.deleted,
    stableValueColumns = listOf(DesignSystemsTable.projectName, DesignSystemsTable.projectId),
    revisionValueColumns = listOf(DesignSystemRevisionTable.name, DesignSystemRevisionTable.description),
)
