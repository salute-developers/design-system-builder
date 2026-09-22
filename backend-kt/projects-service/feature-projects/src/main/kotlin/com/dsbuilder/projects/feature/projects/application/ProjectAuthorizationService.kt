package com.dsbuilder.projects.feature.projects.application

import com.dsbuilder.projects.feature.projects.application.usecase.GetEffectiveProjectRoleUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.GetEffectiveRoleInput
import com.dsbuilder.projects.feature.projects.application.usecase.VerifyProjectAccessKeyInput
import com.dsbuilder.projects.feature.projects.application.usecase.VerifyProjectAccessKeyUseCase

/** Публичный application contract авторизации, не раскрывающий persistence и transport details Projects. */
interface ProjectAuthorizationService {
    /** Вычисляет effective role пользователя в проекте. */
    suspend fun resolveProjectContext(request: ProjectAuthorizationRequest): ProjectAuthorizationResult

    /** Проверяет project access key и возвращает его доверенный context. */
    suspend fun verifyAccessKey(token: String): ProjectAccessKeyAuthorizationResult
}

/** Запрос effective role пользователя в проекте. */
data class ProjectAuthorizationRequest(
    /** Идентификатор пользователя. */
    val userId: String,
    /** Идентификатор проекта. */
    val projectId: String,
    /** Является ли пользователь системным администратором. */
    val isSystemAdmin: Boolean,
)

/** Результат вычисления effective role. */
sealed interface ProjectAuthorizationResult {
    /** Пользователь имеет доступ к проекту. */
    data class Allowed(
        /** Идентификатор проекта. */ val projectId: String,
        /** Effective role пользователя. */ val projectRole: String,
    ) : ProjectAuthorizationResult

    /** Пользователь не имеет доступа к проекту. */
    data object Denied : ProjectAuthorizationResult

    /** Проверка временно недоступна. */
    data object Unavailable : ProjectAuthorizationResult
}

/** Результат проверки project access key. */
sealed interface ProjectAccessKeyAuthorizationResult {
    /** Ключ валиден. */
    data class Valid(
        /** Идентификатор ключа. */ val keyId: String,
        /** Идентификатор проекта. */ val projectId: String,
        /** Разрешённые scopes. */ val scopes: Set<String>,
    ) : ProjectAccessKeyAuthorizationResult

    /** Ключ невалиден. */
    data object Invalid : ProjectAccessKeyAuthorizationResult

    /** Проверка временно недоступна. */
    data object Unavailable : ProjectAccessKeyAuthorizationResult
}

internal class DefaultProjectAuthorizationService(
    private val getEffectiveProjectRole: GetEffectiveProjectRoleUseCase,
    private val verifyProjectAccessKey: VerifyProjectAccessKeyUseCase,
) : ProjectAuthorizationService {
    override suspend fun resolveProjectContext(request: ProjectAuthorizationRequest): ProjectAuthorizationResult =
        runCatching {
            getEffectiveProjectRole.execute(
                GetEffectiveRoleInput(
                    userId = request.userId,
                    projectId = request.projectId,
                    isSystemAdmin = request.isSystemAdmin,
                ),
            )
        }.fold(
            onSuccess = { role ->
                if (role == null) {
                    ProjectAuthorizationResult.Denied
                } else {
                    ProjectAuthorizationResult.Allowed(request.projectId, role.name)
                }
            },
            onFailure = { ProjectAuthorizationResult.Unavailable },
        )

    override suspend fun verifyAccessKey(token: String): ProjectAccessKeyAuthorizationResult =
        runCatching {
            verifyProjectAccessKey.execute(VerifyProjectAccessKeyInput(token))
        }.fold(
            onSuccess = { verified ->
                ProjectAccessKeyAuthorizationResult.Valid(
                    keyId = verified.keyId,
                    projectId = verified.projectId,
                    scopes = verified.scopes.mapTo(linkedSetOf()) { it.value },
                )
            },
            onFailure = { failure ->
                if (failure is ForbiddenProjectActionException) {
                    ProjectAccessKeyAuthorizationResult.Invalid
                } else {
                    ProjectAccessKeyAuthorizationResult.Unavailable
                }
            },
        )
}
