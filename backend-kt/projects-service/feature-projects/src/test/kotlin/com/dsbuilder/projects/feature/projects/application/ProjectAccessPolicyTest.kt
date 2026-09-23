package com.dsbuilder.projects.feature.projects.application

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.projects.feature.projects.application.usecase.AccessKeyManagementPermission
import com.dsbuilder.projects.feature.projects.application.usecase.MemberManagementPermission
import com.dsbuilder.projects.feature.projects.application.usecase.ProjectAccessPolicy
import com.dsbuilder.projects.feature.projects.domain.model.ActorType
import com.dsbuilder.projects.feature.projects.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import java.nio.file.Files
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ProjectAccessPolicyTest {
    private val policy = ProjectAccessPolicy()
    private val project = Project(
        id = "project-1",
        name = "Plasma",
        description = null,
        status = ProjectStatus.ACTIVE,
        ownerUserId = "owner-1",
        createdAt = Instant.parse("2024-01-01T00:00:00Z"),
        updatedAt = Instant.parse("2024-01-01T00:00:00Z"),
    )

    @Test
    fun `owner resolved from project owner field without membership`() {
        val role = policy.resolveRole(
            actor = AuthenticatedActor(type = ActorType.USER, userId = "owner-1", isSystemAdmin = false),
            project = project,
            membership = null,
        )

        assertEquals(ProjectRole.OWNER, role)
    }

    @Test
    fun `system admin gets owner override`() {
        val role = policy.resolveRole(
            actor = AuthenticatedActor(type = ActorType.USER, userId = "admin-1", isSystemAdmin = true),
            project = project,
            membership = null,
        )

        assertEquals(ProjectRole.OWNER, role)
    }

    @Test
    fun `maintainer cannot manage owner membership`() {
        assertFailsWith<ForbiddenProjectActionException> {
            policy.requireMemberManagement(
                actorRole = ProjectRole.MAINTAINER,
                targetUserId = "owner-1",
                project = project,
                permission = MemberManagementPermission.CHANGE_ROLE,
            )
        }
    }

    @Test
    fun `owner role is rejected for project members`() {
        assertFailsWith<InvalidProjectRequestException> {
            policy.validateManageableRole(ProjectRole.OWNER)
        }
    }

    @Test
    fun `member management checks operation-specific permission`() {
        val policyWithoutAdd = policyWithoutMaintainerGrant("members:add")

        assertFailsWith<ForbiddenProjectActionException> {
            policyWithoutAdd.requireMemberManagement(
                actorRole = ProjectRole.MAINTAINER,
                targetUserId = "viewer-1",
                project = project,
                permission = MemberManagementPermission.ADD,
            )
        }
        policyWithoutAdd.requireMemberManagement(
            actorRole = ProjectRole.MAINTAINER,
            targetUserId = "viewer-1",
            project = project,
            permission = MemberManagementPermission.CHANGE_ROLE,
        )
    }

    @Test
    fun `access key management checks operation-specific permission`() {
        val policyWithoutRead = policyWithoutMaintainerGrant("access_keys:read")
        val maintainer = AuthenticatedActor(ActorType.USER, "maintainer-1", isSystemAdmin = false)

        assertFailsWith<ForbiddenProjectActionException> {
            policyWithoutRead.requireAccessKeyManagement(
                maintainer,
                ProjectRole.MAINTAINER,
                AccessKeyManagementPermission.READ,
            )
        }
        policyWithoutRead.requireAccessKeyManagement(
            maintainer,
            ProjectRole.MAINTAINER,
            AccessKeyManagementPermission.CREATE,
        )
    }

    @Test
    fun `archived project blocks mutation`() {
        assertFailsWith<ForbiddenProjectActionException> {
            policy.requireMutableProject(project.copy(status = ProjectStatus.ARCHIVED))
        }
    }

    private fun policyWithoutMaintainerGrant(permission: String): ProjectAccessPolicy {
        val canonical = requireNotNull(javaClass.getResource("/authorization/policy.json")).readText()
        val maintainerOffset = canonical.indexOf("\"maintainer\": {")
        require(maintainerOffset >= 0)
        val grant = "        \"$permission\",\n"
        val modified = canonical.substring(0, maintainerOffset) +
            canonical.substring(maintainerOffset).replaceFirst(grant, "")
        require(modified != canonical)
        val file = Files.createTempFile("authorization-policy", ".json")
        return try {
            Files.writeString(file, modified)
            ProjectAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.load(file)))
        } finally {
            Files.deleteIfExists(file)
        }
    }
}
