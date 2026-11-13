package com.dsbuilder.identity.auth.application.usecase

import com.dsbuilder.identity.auth.application.GatewayAuthorizer

internal class DefaultGatewayAuthorizer(
    private val users: AuthorizeUserRequestUseCase,
    private val projects: AuthorizeProjectRequestUseCase,
) : GatewayAuthorizer {
    override suspend fun user(authorization: String?) = users.execute(authorization)
    override suspend fun project(authorization: String?, projectId: String) =
        projects.execute(GatewayAuthInput(authorization, projectId))
}
