package com.dsbuilder.ds.designsystems

import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus
import com.dsbuilder.ds.designsystems.domain.VersionBoundary
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class VersionBoundaryTest {
    @Test
    fun `status is parsed from the database representation`() {
        assertEquals(DesignSystemVersionStatus.BASELINE, DesignSystemVersionStatus.fromWire("baseline"))
        assertEquals(DesignSystemVersionStatus.DRAFT, DesignSystemVersionStatus.fromWire("draft"))
        assertEquals(DesignSystemVersionStatus.PUBLISHED, DesignSystemVersionStatus.fromWire("published"))
        assertNull(DesignSystemVersionStatus.fromWire("publishing"))
    }

    @Test
    fun `boundary rejects a negative sequence number`() {
        assertFailsWith<IllegalArgumentException> {
            boundary(sequenceNumber = -1)
        }
    }

    @Test
    fun `boundary rejects a negative revision`() {
        assertFailsWith<IllegalArgumentException> {
            boundary(revision = -1)
        }
    }

    private fun boundary(
        sequenceNumber: Long = 0,
        revision: Long = 0,
    ) = VersionBoundary(
        id = DesignSystemVersionId(UUID.randomUUID()),
        designSystemId = DesignSystemId(UUID.randomUUID()),
        sequenceNumber = sequenceNumber,
        revision = revision,
        status = DesignSystemVersionStatus.DRAFT,
    )
}
