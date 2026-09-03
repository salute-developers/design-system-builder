package com.dsbuilder.projects.feature.projects.presentation

import com.dsbuilder.projects.feature.projects.application.usecase.AddProjectMemberInput
import com.dsbuilder.projects.feature.projects.application.usecase.AddProjectMemberUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ArchiveProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectAccessKeyInput
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectInput
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.GetEffectiveProjectRoleUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.GetEffectiveRoleInput
import com.dsbuilder.projects.feature.projects.application.usecase.GetProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectAccessKeysUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectMembersUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectsInput
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectsUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ManageMemberInput
import com.dsbuilder.projects.feature.projects.application.usecase.RemoveProjectMemberUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.RestoreProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.RevokeProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.UpdateProjectInput
import com.dsbuilder.projects.feature.projects.application.usecase.UpdateProjectMemberRoleUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.UpdateProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.VerifyProjectAccessKeyInput
import com.dsbuilder.projects.feature.projects.application.usecase.VerifyProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import org.koin.ktor.ext.inject

/** Регистрирует публичные endpoints проектов и internal endpoint для access-check. */
fun Application.projectsRoutes(internalApiKey: String?) {
    val createProject by inject<CreateProjectUseCase>()
    val listProjects by inject<ListProjectsUseCase>()
    val getProject by inject<GetProjectUseCase>()
    val updateProject by inject<UpdateProjectUseCase>()
    val archiveProject by inject<ArchiveProjectUseCase>()
    val restoreProject by inject<RestoreProjectUseCase>()
    val listProjectMembers by inject<ListProjectMembersUseCase>()
    val addProjectMember by inject<AddProjectMemberUseCase>()
    val updateProjectMemberRole by inject<UpdateProjectMemberRoleUseCase>()
    val removeProjectMember by inject<RemoveProjectMemberUseCase>()
    val createProjectAccessKey by inject<CreateProjectAccessKeyUseCase>()
    val listProjectAccessKeys by inject<ListProjectAccessKeysUseCase>()
    val revokeProjectAccessKey by inject<RevokeProjectAccessKeyUseCase>()
    val verifyProjectAccessKey by inject<VerifyProjectAccessKeyUseCase>()
    val getEffectiveProjectRole by inject<GetEffectiveProjectRoleUseCase>()

    routing {
        get("/health") {
            call.respond(HttpStatusCode.OK)
        }

        projectCrudRoutes(listProjects, createProject, getProject, updateProject, archiveProject, restoreProject)
        projectMemberRoutes(listProjectMembers, addProjectMember, updateProjectMemberRole, removeProjectMember)
        projectAccessKeyRoutes(createProjectAccessKey, listProjectAccessKeys, revokeProjectAccessKey)
        internalProjectRoutes(getEffectiveProjectRole, verifyProjectAccessKey, internalApiKey)
    }
}

private fun Route.projectCrudRoutes(
    listProjects: ListProjectsUseCase,
    createProject: CreateProjectUseCase,
    getProject: GetProjectUseCase,
    updateProject: UpdateProjectUseCase,
    archiveProject: ArchiveProjectUseCase,
    restoreProject: RestoreProjectUseCase,
) {
    route("/projects") {
        listProjectsRoute(listProjects)

        post {
            runCatching {
                val actor = call.requireActor()
                val request = call.receive<CreateProjectRequest>()
                createProject.execute(
                    CreateProjectInput(
                        actor = actor,
                        name = request.name,
                        description = request.description,
                    ),
                )
            }.onSuccess { call.respond(HttpStatusCode.Created, it.toResponse()) }
                .onFailure { call.respondProjectError(it) }
        }

        get("{projectId}") {
            runCatching {
                val actor = call.requireActor()
                val projectId = call.parameters["projectId"].orEmpty()
                getProject.execute(actor, projectId)
            }.onSuccess { call.respond(it.toResponse()) }
                .onFailure { call.respondProjectError(it) }
        }

        patch("{projectId}") {
            runCatching {
                val actor = call.requireActor()
                val request = call.receive<UpdateProjectRequest>()
                updateProject.execute(
                    UpdateProjectInput(
                        actor = actor,
                        projectId = call.parameters["projectId"].orEmpty(),
                        name = request.name,
                        description = request.description,
                    ),
                )
            }.onSuccess { call.respond(it.toResponse()) }
                .onFailure { call.respondProjectError(it) }
        }

        post("{projectId}/archive") {
            runCatching {
                archiveProject.execute(call.requireActor(), call.parameters["projectId"].orEmpty())
            }.onSuccess { call.respond(it.toResponse()) }
                .onFailure { call.respondProjectError(it) }
        }

        post("{projectId}/restore") {
            runCatching {
                restoreProject.execute(call.requireActor(), call.parameters["projectId"].orEmpty())
            }.onSuccess { call.respond(it.toResponse()) }
                .onFailure { call.respondProjectError(it) }
        }
    }
}

private fun Route.listProjectsRoute(listProjects: ListProjectsUseCase) {
    get {
        runCatching {
            listProjects.execute(ListProjectsInput(actor = call.requireActor()))
        }.onSuccess { projects ->
            call.respond(projects.map { it.toResponse() })
        }.onFailure { call.respondProjectError(it) }
    }
}

private fun Route.projectMemberRoutes(
    listProjectMembers: ListProjectMembersUseCase,
    addProjectMember: AddProjectMemberUseCase,
    updateProjectMemberRole: UpdateProjectMemberRoleUseCase,
    removeProjectMember: RemoveProjectMemberUseCase,
) {
    route("/projects/{projectId}/members") {
        get {
            runCatching {
                listProjectMembers.execute(call.requireActor(), call.parameters["projectId"].orEmpty())
            }.onSuccess { members ->
                call.respond(members.map { it.toResponse() })
            }.onFailure { call.respondProjectError(it) }
        }

        post {
            runCatching {
                val request = call.receive<UpsertProjectMemberRequest>()
                addProjectMember.execute(
                    AddProjectMemberInput(
                        actor = call.requireActor(),
                        projectId = call.parameters["projectId"].orEmpty(),
                        email = request.email,
                        role = ProjectRole.valueOf(request.normalizedRole()),
                    ),
                )
            }.onSuccess { call.respond(HttpStatusCode.Created, it.toResponse()) }
                .onFailure { call.respondProjectError(it) }
        }

        patch("{userId}") {
            runCatching {
                val request = call.receive<UpdateProjectMemberRoleRequest>()
                updateProjectMemberRole.execute(
                    ManageMemberInput(
                        actor = call.requireActor(),
                        projectId = call.parameters["projectId"].orEmpty(),
                        userId = call.parameters["userId"].orEmpty(),
                        role = ProjectRole.valueOf(request.normalizedRole()),
                    ),
                )
            }.onSuccess { call.respond(it.toResponse()) }
                .onFailure { call.respondProjectError(it) }
        }

        delete("{userId}") {
            runCatching {
                removeProjectMember.execute(
                    actor = call.requireActor(),
                    projectId = call.parameters["projectId"].orEmpty(),
                    userId = call.parameters["userId"].orEmpty(),
                )
            }.onSuccess { call.respond(HttpStatusCode.NoContent) }
                .onFailure { call.respondProjectError(it) }
        }
    }
}

private fun Route.projectAccessKeyRoutes(
    createProjectAccessKey: CreateProjectAccessKeyUseCase,
    listProjectAccessKeys: ListProjectAccessKeysUseCase,
    revokeProjectAccessKey: RevokeProjectAccessKeyUseCase,
) {
    route("/projects/{projectId}/access-keys") {
        get {
            runCatching {
                listProjectAccessKeys.execute(call.requireActor(), call.parameters["projectId"].orEmpty())
            }.onSuccess { keys ->
                call.respond(keys.map { it.toResponse() })
            }.onFailure { call.respondProjectError(it) }
        }

        post {
            runCatching {
                val request = call.receive<CreateProjectAccessKeyRequest>()
                createProjectAccessKey.execute(
                    CreateProjectAccessKeyInput(
                        actor = call.requireActor(),
                        projectId = call.parameters["projectId"].orEmpty(),
                        name = request.name,
                        scopes = request.normalizedScopes(),
                        ttlSeconds = request.ttlSeconds,
                    ),
                )
            }.onSuccess { created ->
                call.respond(
                    HttpStatusCode.Created,
                    CreatedProjectAccessKeyResponse(
                        key = created.accessKey.toResponse(),
                        secret = created.token,
                    ),
                )
            }.onFailure { call.respondProjectError(it) }
        }

        delete("{keyId}") {
            runCatching {
                revokeProjectAccessKey.execute(
                    actor = call.requireActor(),
                    projectId = call.parameters["projectId"].orEmpty(),
                    keyId = call.parameters["keyId"].orEmpty(),
                )
            }.onSuccess { call.respond(it.toResponse()) }
                .onFailure { call.respondProjectError(it) }
        }
    }
}

private fun Route.internalProjectRoutes(
    getEffectiveProjectRole: GetEffectiveProjectRoleUseCase,
    verifyProjectAccessKey: VerifyProjectAccessKeyUseCase,
    internalApiKey: String?,
) {
    route("/internal/projects") {
        get("{projectId}/access-check") {
            runCatching {
                call.requireInternalAccess(internalApiKey)
                val actor = call.requireActor()
                val projectRole = getEffectiveProjectRole.execute(
                    GetEffectiveRoleInput(
                        userId = actor.userId,
                        projectId = call.parameters["projectId"].orEmpty(),
                        isSystemAdmin = actor.isSystemAdmin,
                    ),
                )
                if (projectRole == null) {
                    call.respond(HttpStatusCode.Forbidden, ErrorResponse("Project access denied"))
                } else {
                    call.respond(
                        HttpStatusCode.OK,
                        ProjectAccessCheckResponse(projectRole = projectRole.name.lowercase()),
                    )
                }
            }.onFailure { call.respondProjectError(it) }
        }
    }

    route("/internal/access-keys") {
        post("/verify") {
            runCatching {
                call.requireInternalAccess(internalApiKey)
                val request = call.receive<VerifyProjectAccessKeyRequest>()
                verifyProjectAccessKey.execute(VerifyProjectAccessKeyInput(request.token))
            }.onSuccess { verification ->
                call.respond(
                    HttpStatusCode.OK,
                    VerifyProjectAccessKeyResponse(
                        projectId = verification.projectId,
                        keyId = verification.keyId,
                        scopes = verification.scopes.map { it.value }.sorted(),
                    ),
                )
            }.onFailure { call.respondProjectError(it) }
        }
    }
}
