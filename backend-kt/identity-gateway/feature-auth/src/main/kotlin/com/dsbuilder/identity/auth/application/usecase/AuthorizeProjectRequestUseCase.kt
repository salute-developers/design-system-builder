package com.dsbuilder.identity.auth.application.usecase

import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenResult
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.domain.model.ActorType
import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.GlobalRole
import com.dsbuilder.identity.auth.domain.model.ProjectContext
import com.dsbuilder.identity.auth.domain.model.ProjectRole
import com.dsbuilder.identity.auth.domain.model.TrustedHeaders

internal class AuthorizeProjectRequestUseCase(
    private val jwtVerifier: JwtVerifier,
    private val projectContextResolver: ProjectContextResolver,
    private val personalTokens: PersonalAccessTokenVerifier =
        PersonalAccessTokenVerifier {
            PersonalAccessTokenResult.Invalid
        },
) {
    suspend fun execute(input: GatewayAuthInput): GatewayAuthDecision {
        val authorizationHeader = input.authorizationHeader
            ?: return GatewayAuthDecision.Unauthorized("Missing authorization header")

        val bearerToken = authorizationHeader.extractBearerToken()
        if (bearerToken?.startsWith("dsb_pat_") == true) return authorizePersonalToken(bearerToken, input.projectId)
        return if (bearerToken != null) {
            when (val verified = jwtVerifier.verify(bearerToken)) {
                is JwtVerificationResult.Invalid -> verified.reason.toDecision()
                is JwtVerificationResult.Valid -> authorizeActor(verified.actor, input.projectId)
            }
        } else {
            GatewayAuthDecision.Unauthorized("Unsupported authorization scheme")
        }
    }

    private suspend fun authorizePersonalToken(token: String, projectId: String): GatewayAuthDecision {
        return when (val verified = personalTokens.verify(token)) {
            is PersonalAccessTokenResult.Valid -> {
                val actor = AuthenticatedActor(
                    ActorType.USER,
                    verified.userId,
                    null,
                    if (verified.systemAdmin) {
                        setOf(GlobalRole.SYSTEM_ADMIN)
                    } else {
                        emptySet()
                    },
                )
                val context = if (verified.systemAdmin) {
                    ProjectContext(projectId, ProjectRole.OWNER)
                } else {
                    when (val resolved = projectContextResolver.resolve(actor, projectId)) {
                        is ProjectContextResolution.Allowed -> resolved.context
                        ProjectContextResolution.Denied -> return GatewayAuthDecision.Forbidden("Project access denied")
                        ProjectContextResolution.Unavailable -> return GatewayAuthDecision.Unavailable(
                            "Project access unavailable",
                        )
                    }
                }
                GatewayAuthDecision.Allowed(
                    TrustedHeaders(
                        actorType = ActorType.PERSONAL_ACCESS_TOKEN.headerValue,
                        userId = verified.userId,
                        projectId = context.projectId,
                        projectRole = context.projectRole.headerValue,
                        personalAccessTokenId = verified.tokenId,
                        projectScopes = verified.scopes.sorted().joinToString(","),
                        systemAdmin = verified.systemAdmin.toString(),
                    ),
                )
            }
            PersonalAccessTokenResult.Invalid ->
                GatewayAuthDecision.Unauthorized("Invalid personal access token")
            PersonalAccessTokenResult.Unavailable ->
                GatewayAuthDecision.Unavailable("Identity check unavailable")
        }
    }

    private suspend fun authorizeActor(
        actor: AuthenticatedActor,
        projectId: String,
    ): GatewayAuthDecision {
        val context = if (actor.isSystemAdmin) {
            ProjectContext(projectId = projectId, projectRole = ProjectRole.OWNER)
        } else {
            when (val resolution = projectContextResolver.resolve(actor, projectId)) {
                is ProjectContextResolution.Allowed -> resolution.context
                ProjectContextResolution.Denied -> return GatewayAuthDecision.Forbidden("Project access denied")
                ProjectContextResolution.Unavailable -> return GatewayAuthDecision.Forbidden(
                    "Project access unavailable",
                )
            }
        }

        return GatewayAuthDecision.Allowed(
            TrustedHeaders(
                actorType = actor.type.headerValue,
                userId = actor.userId,
                projectId = context.projectId,
                projectRole = context.projectRole.headerValue,
                systemAdmin = actor.isSystemAdmin.toString(),
            ),
        )
    }
}

internal data class GatewayAuthInput(
    val authorizationHeader: String?,
    val projectId: String,
)

/** Результат проверки учётных данных и проектной границы. */
sealed interface GatewayAuthDecision {
    /** Временная недоступность обязательной проверки. */
    data class Unavailable(/** Безопасная причина недоступности. */ val reason: String) : GatewayAuthDecision

    /** Разрешение с нормализованным контекстом.
     * @property trustedHeaders Проверенные поля участника.
     */
    data class Allowed(val trustedHeaders: TrustedHeaders) : GatewayAuthDecision

    /** Отсутствующие или недействительные учётные данные.
     * @property reason Безопасная причина отказа.
     */
    data class Unauthorized(val reason: String) : GatewayAuthDecision

    /** Отказ в доступе к запрошенному проекту.
     * @property reason Безопасная причина отказа.
     */
    data class Forbidden(val reason: String) : GatewayAuthDecision
}
