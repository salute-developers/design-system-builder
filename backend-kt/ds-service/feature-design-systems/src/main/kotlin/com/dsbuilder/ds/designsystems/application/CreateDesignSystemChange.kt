package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.designsystems.domain.ChangeOperation
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import java.util.UUID

/** Validated input for a design-system audit entry. */
data class CreateDesignSystemChange(
    /** Design system id carried by this contract. */
    val designSystemId: DesignSystemId,
    /** Entity type carried by this contract. */
    val entityType: String,
    /** Entity id carried by this contract. */
    val entityId: UUID,
    /** Operation carried by this contract. */
    val operation: ChangeOperation,
    /** Data json carried by this contract. */
    val dataJson: String?,
)
