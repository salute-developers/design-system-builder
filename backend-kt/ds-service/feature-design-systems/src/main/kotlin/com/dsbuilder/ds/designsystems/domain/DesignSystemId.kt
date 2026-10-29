package com.dsbuilder.ds.designsystems.domain

import java.util.UUID

/** Identifier of a design system. */
@JvmInline
value class DesignSystemId(/** Value carried by this contract. */ val value: UUID)
