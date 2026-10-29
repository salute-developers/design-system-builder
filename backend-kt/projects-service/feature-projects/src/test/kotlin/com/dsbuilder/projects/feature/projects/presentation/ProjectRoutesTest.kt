package com.dsbuilder.projects.feature.projects.presentation

import com.dsbuilder.projects.feature.projects.application.IdentityProviderUnavailableException
import com.dsbuilder.projects.feature.projects.application.port.AccessKeySecretManager
import com.dsbuilder.projects.feature.projects.application.port.IdentityUser
import com.dsbuilder.projects.feature.projects.application.port.IdentityUserLookup
import com.dsbuilder.projects.feature.projects.application.port.ProjectRepository
import com.dsbuilder.projects.feature.projects.application.port.TransactionManager
import com.dsbuilder.projects.feature.projects.application.usecase.AddProjectMemberUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ArchiveProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.GetEffectiveProjectRoleUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.GetProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectAccessKeysUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectMembersUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectsUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ProjectAccessPolicy
import com.dsbuilder.projects.feature.projects.application.usecase.RemoveProjectMemberUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.RestoreProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.RevokeProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.SearchProjectMemberCandidatesUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.UpdateProjectMemberRoleUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.UpdateProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.VerifyProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.data.local.AccessKeyConfiguration
import com.dsbuilder.projects.feature.projects.data.local.AccessKeyHashingConfiguration
import com.dsbuilder.projects.feature.projects.domain.model.AccessKeyScope
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKey
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKeyStatus
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.days

class ProjectRoutesTest {
    private val clock = Clock.fixed(Instant.parse("2024-01-01T00:00:00Z"), ZoneOffset.UTC)

    @Test
    fun `create and read project`() = testApplication {
        val repository = routeRepository()
        val identityUserLookup = RouteIdentityUserLookup().apply {
            usersByEmail["owner@example.com"] = IdentityUser(
                userId = "owner-1",
                email = "owner@example.com",
                displayName = "Owner User",
                username = "owner",
            )
        }
        installTestModule(repository, identityUserLookup)

        val createResponse = client.post("/projects") {
            header("X-User-Id", "owner-1")
            contentType(ContentType.Application.Json)
            setBody("""{"name":"Workspace","description":"Main"}""")
        }

        assertEquals(HttpStatusCode.Created, createResponse.status)

        val projectId = Json.parseToJsonElement(createResponse.bodyAsText())
            .jsonObject["id"]!!.toString().trim('"')

        val getResponse = client.get("/projects/$projectId") {
            header("X-User-Id", "owner-1")
        }

        assertEquals(HttpStatusCode.OK, getResponse.status)
        assertEquals(
            "owner",
            Json.parseToJsonElement(getResponse.bodyAsText()).jsonObject["effectiveRole"]!!.toString().trim('"'),
        )
    }

    @Test
    fun `list projects returns only projects available to user`() = testApplication {
        val repository = routeRepository().apply {
            seedProject(
                Project(
                    id = "project-1",
                    name = "Owned workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "user-1",
                    createdAt = Instant.parse("2024-01-01T00:00:00Z"),
                    updatedAt = Instant.parse("2024-01-01T00:00:00Z"),
                ),
            )
            seedProject(
                Project(
                    id = "project-2",
                    name = "Member workspace",
                    description = null,
                    status = ProjectStatus.ARCHIVED,
                    ownerUserId = "owner-2",
                    createdAt = Instant.parse("2024-01-02T00:00:00Z"),
                    updatedAt = Instant.parse("2024-01-02T00:00:00Z"),
                ),
            )
            seedProject(
                Project(
                    id = "project-3",
                    name = "Foreign workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-3",
                    createdAt = Instant.parse("2024-01-03T00:00:00Z"),
                    updatedAt = Instant.parse("2024-01-03T00:00:00Z"),
                ),
            )
            seedMember(
                ProjectMember(
                    "project-2",
                    "user-1",
                    ProjectRole.VIEWER,
                    Instant.parse("2024-01-02T00:00:00Z"),
                    Instant.parse("2024-01-02T00:00:00Z"),
                ),
            )
        }
        installTestModule(repository, RouteIdentityUserLookup())

        val response = client.get("/projects") {
            header("X-User-Id", "user-1")
        }

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertEquals(true, body.contains("project-1"))
        assertEquals(true, body.contains("project-2"))
        assertEquals(false, body.contains("project-3"))
        assertTrue(body.contains("\"effectiveRole\":\"owner\""))
        assertTrue(body.contains("\"effectiveRole\":\"viewer\""))
    }

    @Test
    fun `get project returns owner maintainer editor viewer and system admin roles`() = testApplication {
        val repository = routeRepository().apply {
            val now = Instant.now(clock)
            seedProject(
                Project(
                    "project-1",
                    "Workspace",
                    null,
                    ProjectStatus.ACTIVE,
                    "owner-1",
                    now,
                    now,
                ),
            )
            listOf(ProjectRole.MAINTAINER, ProjectRole.EDITOR, ProjectRole.VIEWER).forEach { role ->
                seedMember(ProjectMember("project-1", role.name.lowercase(), role, now, now))
            }
        }
        val identityUserLookup = RouteIdentityUserLookup().apply {
            usersByEmail["owner@example.com"] = IdentityUser(
                userId = "owner-1",
                email = "owner@example.com",
                displayName = "Owner User",
                username = "owner",
            )
        }
        installTestModule(repository, identityUserLookup)

        val actors = listOf(
            "owner-1" to "owner",
            "maintainer" to "maintainer",
            "editor" to "editor",
            "viewer" to "viewer",
        )
        actors.forEach { (userId, expectedRole) ->
            val response = client.get("/projects/project-1") { header("X-User-Id", userId) }
            assertEquals(HttpStatusCode.OK, response.status)
            assertTrue(response.bodyAsText().contains("\"effectiveRole\":\"$expectedRole\""))
            assertTrue(response.bodyAsText().contains("\"ownerDisplayName\":\"Owner User\""))
            assertTrue(response.bodyAsText().contains("\"ownerEmail\":\"owner@example.com\""))
        }
        val projectKey = client.get("/projects/project-1") {
            header("X-Actor-Type", "project_key")
            header("X-User-Id", "key-1")
            header("X-Project-Id", "project-1")
            header("X-Project-Key-Id", "key-1")
            header("X-Project-Scopes", "projects:read")
        }
        assertEquals(HttpStatusCode.OK, projectKey.status)
        assertTrue(!projectKey.bodyAsText().contains("Owner User"))
        assertTrue(!projectKey.bodyAsText().contains("owner@example.com"))
        val admin = client.get("/projects/project-1") {
            header("X-User-Id", "admin-1")
            header("X-System-Admin", "true")
        }
        assertEquals(HttpStatusCode.OK, admin.status)
        assertTrue(admin.bodyAsText().contains("\"effectiveRole\":\"owner\""))
    }

    @Test
    fun `member endpoints manage role changes`() = testApplication {
        val repository = routeRepository().apply {
            seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
            seedMember(
                ProjectMember(
                    "project-1",
                    "maintainer-1",
                    ProjectRole.MAINTAINER,
                    Instant.now(clock),
                    Instant.now(clock),
                ),
            )
        }
        val identityUserLookup = RouteIdentityUserLookup().apply {
            usersByEmail["editor@example.com"] = IdentityUser(
                userId = "editor-1",
                email = "editor@example.com",
                displayName = "Editor One",
            )
        }
        installTestModule(repository, identityUserLookup)

        val addResponse = client.post("/projects/project-1/members") {
            header("X-User-Id", "maintainer-1")
            contentType(ContentType.Application.Json)
            setBody("""{"email":"editor@example.com","role":"editor"}""")
        }
        val patchResponse = client.patch("/projects/project-1/members/editor-1") {
            header("X-User-Id", "maintainer-1")
            contentType(ContentType.Application.Json)
            setBody("""{"role":"viewer"}""")
        }
        val listResponse = client.get("/projects/project-1/members") {
            header("X-User-Id", "maintainer-1")
        }
        val deleteResponse = client.delete("/projects/project-1/members/editor-1") {
            header("X-User-Id", "maintainer-1")
        }

        assertEquals(HttpStatusCode.Created, addResponse.status)
        assertEquals(HttpStatusCode.OK, patchResponse.status)
        assertEquals(HttpStatusCode.OK, listResponse.status)
        assertTrue(listResponse.bodyAsText().contains("Editor One"))
        assertTrue(listResponse.bodyAsText().contains("editor@example.com"))
        assertEquals(HttpStatusCode.NoContent, deleteResponse.status)
    }

    @Test
    fun `member add returns not found for missing registered email`() = testApplication {
        val repository = routeRepository().apply {
            seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
        }
        installTestModule(repository, RouteIdentityUserLookup())

        val response = client.post("/projects/project-1/members") {
            header("X-User-Id", "owner-1")
            contentType(ContentType.Application.Json)
            setBody("""{"email":"missing@example.com","role":"viewer"}""")
        }

        assertEquals(HttpStatusCode.NotFound, response.status)
        assertEquals(true, response.bodyAsText().contains("registered_user_not_found"))
    }

    @Test
    fun `member candidates are searchable by username and display name`() = testApplication {
        val identityUserLookup = RouteIdentityUserLookup().apply {
            usersByEmail["alex@example.com"] = IdentityUser(
                userId = "user-2",
                email = "alex@example.com",
                displayName = "Alex User",
                username = "alex",
            )
        }
        installTestModule(routeRepository(), identityUserLookup)

        val response = client.get("/projects/member-candidates?query=ale") {
            header("X-User-Id", "owner-1")
        }

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(true, response.bodyAsText().contains("alex@example.com"))
        assertEquals(true, response.bodyAsText().contains("Alex User"))
    }

    @Test
    fun `member add returns service unavailable when identity provider fails`() = testApplication {
        val repository = routeRepository().apply {
            seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
        }
        installTestModule(
            repository,
            object : IdentityUserLookup {
                override suspend fun findRegisteredUserByEmail(email: String): IdentityUser? {
                    throw IdentityProviderUnavailableException()
                }
            },
        )

        val response = client.post("/projects/project-1/members") {
            header("X-User-Id", "owner-1")
            contentType(ContentType.Application.Json)
            setBody("""{"email":"user@example.com","role":"viewer"}""")
        }

        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        assertEquals(true, response.bodyAsText().contains("identity_provider_unavailable"))
    }

    @Test
    fun `project and member reads survive identity provider failure`() = testApplication {
        val now = Instant.now(clock)
        val repository = routeRepository().apply {
            seedProject(
                Project("project-1", "Workspace", null, ProjectStatus.ACTIVE, "owner-1", now, now),
            )
            seedMember(ProjectMember("project-1", "member-1", ProjectRole.VIEWER, now, now))
        }
        installTestModule(
            repository,
            object : IdentityUserLookup {
                override suspend fun findRegisteredUserByEmail(email: String): IdentityUser? {
                    throw IdentityProviderUnavailableException()
                }
            },
        )

        val projectResponse = client.get("/projects/project-1") {
            header("X-User-Id", "owner-1")
        }
        val membersResponse = client.get("/projects/project-1/members") {
            header("X-User-Id", "owner-1")
        }

        assertEquals(HttpStatusCode.OK, projectResponse.status)
        assertTrue(projectResponse.bodyAsText().contains("owner-1"))
        assertEquals(HttpStatusCode.OK, membersResponse.status)
        assertTrue(membersResponse.bodyAsText().contains("member-1"))
    }

    @Test
    fun `access key endpoints create list verify and revoke key`() = testApplication {
        val repository = routeRepository().apply {
            seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
        }
        installTestModule(repository, RouteIdentityUserLookup())

        val createResponse = client.post("/projects/project-1/access-keys") {
            header("X-User-Id", "owner-1")
            contentType(ContentType.Application.Json)
            setBody("""{"name":"CLI key","scopes":["projects:read"],"ttlSeconds":3600}""")
        }
        assertEquals(HttpStatusCode.Created, createResponse.status)

        val createdJson = Json.parseToJsonElement(createResponse.bodyAsText()).jsonObject
        val keyId = createdJson["key"]!!.jsonObject["id"]!!.toString().trim('"')
        val token = createdJson["secret"]!!.toString().trim('"')

        val listResponse = client.get("/projects/project-1/access-keys") {
            header("X-User-Id", "owner-1")
        }
        assertEquals(HttpStatusCode.OK, listResponse.status)
        assertEquals(true, listResponse.bodyAsText().contains(keyId))

        val verifyResponse = client.post("/internal/access-keys/verify") {
            contentType(ContentType.Application.Json)
            setBody("""{"token":"$token"}""")
        }
        assertEquals(HttpStatusCode.OK, verifyResponse.status)

        val revokeResponse = client.delete("/projects/project-1/access-keys/$keyId") {
            header("X-User-Id", "owner-1")
        }
        assertEquals(HttpStatusCode.OK, revokeResponse.status)
    }

    @Test
    fun `documentation scopes are independent and unknown scopes are rejected`() = testApplication {
        val repository = routeRepository().apply {
            seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
        }
        installTestModule(repository, RouteIdentityUserLookup())

        val readOnly = client.post("/projects/project-1/access-keys") {
            header("X-User-Id", "owner-1")
            contentType(ContentType.Application.Json)
            setBody("""{"name":"Docs reader","scopes":["documentation:read"],"ttlSeconds":3600}""")
        }
        val unknown = client.post("/projects/project-1/access-keys") {
            header("X-User-Id", "owner-1")
            contentType(ContentType.Application.Json)
            setBody("""{"name":"Invalid","scopes":["documentation:publish"],"ttlSeconds":3600}""")
        }

        assertEquals(HttpStatusCode.Created, readOnly.status)
        assertTrue(readOnly.bodyAsText().contains("documentation:read"))
        assertFalse(readOnly.bodyAsText().contains("documentation:write"))
        assertEquals(HttpStatusCode.BadRequest, unknown.status)
    }

    @Test
    fun `internal access check returns owner for system admin`() = testApplication {
        val repository = routeRepository().apply {
            seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
        }
        installTestModule(repository, RouteIdentityUserLookup())

        val response = client.get("/internal/projects/project-1/access-check") {
            header("X-User-Id", "admin-1")
            header("X-System-Admin", "true")
        }

        assertEquals(HttpStatusCode.OK, response.status)
    }

    private fun ApplicationTestBuilder.installTestModule(
        repository: RouteProjectRepository,
        identityUserLookup: IdentityUserLookup,
    ) {
        application {
            install(ContentNegotiation) {
                json()
            }
            install(Koin) {
                modules(
                    module {
                        single<Clock> { clock }
                        single { ProjectAccessPolicy() }
                        single<IdentityUserLookup> { identityUserLookup }
                        single<ProjectRepository> { repository }
                        single<TransactionManager> { RouteTransactionManager }
                        single<AccessKeySecretManager> { RouteAccessKeySecretManager }
                        single {
                            AccessKeyConfiguration(
                                keyPrefix = "dsb_pk",
                                defaultTtl = 30.days,
                                secretByteLength = 32,
                                availableScopes = setOf(
                                    AccessKeyScope.parse("projects:read")!!,
                                    AccessKeyScope.parse("members:read")!!,
                                    AccessKeyScope.parse("documentation:read")!!,
                                    AccessKeyScope.parse("documentation:write")!!,
                                ),
                                hashing = AccessKeyHashingConfiguration(
                                    iterations = 1,
                                    keyLengthBits = 256,
                                    saltByteLength = 16,
                                ),
                            )
                        }
                        single { CreateProjectUseCase(get(), get(), get(), get()) }
                        single { ListProjectsUseCase(get(), get(), get()) }
                        single { GetProjectUseCase(get(), get(), get(), get()) }
                        single { UpdateProjectUseCase(get(), get(), get(), get()) }
                        single { ArchiveProjectUseCase(get(), get(), get(), get()) }
                        single { RestoreProjectUseCase(get(), get(), get(), get()) }
                        single { ListProjectMembersUseCase(get(), get(), get(), get()) }
                        single { AddProjectMemberUseCase(get(), get(), get(), get(), get()) }
                        single { SearchProjectMemberCandidatesUseCase(get()) }
                        single { UpdateProjectMemberRoleUseCase(get(), get(), get(), get()) }
                        single { RemoveProjectMemberUseCase(get(), get(), get()) }
                        single { CreateProjectAccessKeyUseCase(get(), get(), get(), get(), get(), get()) }
                        single { ListProjectAccessKeysUseCase(get(), get(), get()) }
                        single { RevokeProjectAccessKeyUseCase(get(), get(), get(), get()) }
                        single { VerifyProjectAccessKeyUseCase(get(), get(), get(), get(), get(), get()) }
                        single { GetEffectiveProjectRoleUseCase(get(), get(), get()) }
                    },
                )
            }
            projectsRoutes(internalApiKey = null)
        }
    }
}

private object RouteTransactionManager : TransactionManager {
    override suspend fun <T> required(block: suspend () -> T): T = block()
}

private class RouteProjectRepository : ProjectRepository {
    private val projects = linkedMapOf<String, Project>()
    private val members = linkedMapOf<Pair<String, String>, ProjectMember>()
    private val accessKeys = linkedMapOf<String, ProjectAccessKey>()

    override suspend fun createProject(project: Project) {
        projects[project.id] = project
    }

    override suspend fun listProjectsForUser(userId: String): List<Project> =
        projects.values.filter { project ->
            project.ownerUserId == userId || members.containsKey(project.id to userId)
        }

    override suspend fun listAllProjects(): List<Project> = projects.values.toList()

    override suspend fun getProject(projectId: String): Project? = projects[projectId]

    override suspend fun updateProjectMetadata(
        projectId: String,
        name: String,
        description: String?,
        updatedAt: Instant,
    ): Project? {
        val current = projects[projectId] ?: return null
        return current.copy(name = name, description = description, updatedAt = updatedAt).also {
            projects[projectId] = it
        }
    }

    override suspend fun updateProjectStatus(
        projectId: String,
        status: ProjectStatus,
        updatedAt: Instant,
    ): Project? {
        val current = projects[projectId] ?: return null
        return current.copy(status = status, updatedAt = updatedAt).also {
            projects[projectId] = it
        }
    }

    override suspend fun listMembers(projectId: String): List<ProjectMember> =
        members.values.filter { it.projectId == projectId }

    override suspend fun getMember(projectId: String, userId: String): ProjectMember? =
        members[projectId to userId]

    override suspend fun upsertMember(member: ProjectMember) {
        members[member.projectId to member.userId] = member
    }

    override suspend fun removeMember(projectId: String, userId: String): Boolean =
        members.remove(projectId to userId) != null

    override suspend fun createAccessKey(accessKey: ProjectAccessKey) {
        accessKeys[accessKey.id] = accessKey
    }

    override suspend fun listAccessKeys(projectId: String): List<ProjectAccessKey> =
        accessKeys.values.filter { it.projectId == projectId }

    override suspend fun getAccessKey(projectId: String, keyId: String): ProjectAccessKey? =
        accessKeys[keyId]?.takeIf { it.projectId == projectId }

    override suspend fun getAccessKeyById(keyId: String): ProjectAccessKey? = accessKeys[keyId]

    override suspend fun updateAccessKeyUsage(keyId: String, lastUsedAt: Instant, updatedAt: Instant) {
        val current = accessKeys[keyId] ?: return
        accessKeys[keyId] = current.copy(lastUsedAt = lastUsedAt, updatedAt = updatedAt)
    }

    override suspend fun updateAccessKeyStatus(
        projectId: String,
        keyId: String,
        status: ProjectAccessKeyStatus,
        revokedAt: Instant?,
        updatedAt: Instant,
    ): ProjectAccessKey? {
        val current = accessKeys[keyId]?.takeIf { it.projectId == projectId } ?: return null
        return current.copy(revokedAt = revokedAt, updatedAt = updatedAt).also {
            accessKeys[keyId] = it
        }
    }

    fun seedProject(project: Project) {
        projects[project.id] = project
    }

    fun seedMember(member: ProjectMember) {
        members[member.projectId to member.userId] = member
    }
}

private fun routeRepository(): RouteProjectRepository = RouteProjectRepository()

private class RouteIdentityUserLookup : IdentityUserLookup {
    val usersByEmail = linkedMapOf<String, IdentityUser>()

    override suspend fun findRegisteredUserByEmail(email: String): IdentityUser? = usersByEmail[email]

    override suspend fun findRegisteredUserById(userId: String): IdentityUser? =
        usersByEmail.values.firstOrNull { it.userId == userId }

    override suspend fun searchRegisteredUsers(query: String, limit: Int): List<IdentityUser> =
        usersByEmail.values.filter { user ->
            listOfNotNull(user.displayName, user.username, user.email).any { it.contains(query, ignoreCase = true) }
        }.take(limit)
}

private object RouteAccessKeySecretManager : AccessKeySecretManager {
    override fun generateSecret(): String = "route-secret"

    override fun hashSecret(rawSecret: String): String = "hashed:$rawSecret"

    override fun verifySecret(rawSecret: String, secretHash: String): Boolean = secretHash == "hashed:$rawSecret"
}
