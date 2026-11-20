package com.dsbuilder.app.data

import com.dsbuilder.ai.chat.application.AccessCheck
import com.dsbuilder.ai.chat.application.ChatAccess
import com.dsbuilder.ai.chat.application.ChatAccessRefresher
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorization
import com.dsbuilder.settings.application.PersonalAccessTokenVerification
import com.dsbuilder.settings.application.PersonalAccessTokens
import kotlinx.coroutines.CancellationException

/**
 * Актуализирует права участника ИИ-чата внутри процесса перед каждым вызовом инструмента: для PAT — отзыв, срок и
 * состояние владельца, затем роль в проекте. Без HTTP и без Bearer пользователя.
 */
class InProcessChatAccess(
    private val projects: ProjectAuthorization,
    private val tokens: PersonalAccessTokens,
    private val evaluator: PolicyEvaluator,
) : ChatAccessRefresher {
    override suspend fun refresh(principal: ProjectPrincipal): AccessCheck = try {
        current(principal)
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (@Suppress("TooGenericExceptionCaught") _: Exception) {
        AccessCheck.Unavailable
    }

    private suspend fun current(principal: ProjectPrincipal): AccessCheck {
        val token = principal.personalAccessTokenId?.let { tokens.recheck(it, principal.actorId) }
        if (token != null && token !is PersonalAccessTokenVerification.Valid) {
            val unavailable = token == PersonalAccessTokenVerification.Unavailable
            return if (unavailable) AccessCheck.Unavailable else AccessCheck.Revoked
        }
        val systemAdmin =
            (token as? PersonalAccessTokenVerification.Valid)?.token?.systemAdmin ?: principal.systemAdmin
        val role = projects.role(principal.actorId, principal.projectId, systemAdmin) ?: return AccessCheck.Revoked
        val current = principal.copy(projectRole = role, systemAdmin = systemAdmin)
        return AccessCheck.Current(current, ChatAccess { evaluator.isAllowed(current, it) })
    }
}
