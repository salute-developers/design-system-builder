package com.dsbuilder.ds.core.application

import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.domain.ProjectId

/**
 * Trusted actor and request metadata shared by application use cases.
 *
 * @property principal principal created by authorization-core from trusted headers
 * @property correlationId request correlation identifier
 */
data class DsRequestContext(
    val principal: ProjectPrincipal,
    val correlationId: String,
) {
    /** Project boundary derived exclusively from [principal]. */
    val projectId: ProjectId = ProjectId(principal.projectId)
}
