package com.dsbuilder.identity.auth.application

import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision

/** Минимальная граница проверки личности и доступа публичного входа. */
interface GatewayAuthorizer {
    /** Проверяет пользовательские учётные данные. */
    suspend fun user(authorization: String?): GatewayAuthDecision

    /** Проверяет доступ пользователя или ключа к проекту. */
    suspend fun project(authorization: String?, projectId: String): GatewayAuthDecision
}
