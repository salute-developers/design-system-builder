package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl

/** Авторизация каталогов CLI/MCP через PAT/OAuth; IDE передаёт явно выбранную сессию. */
public class UserSessionAccess private constructor(
    private val resolveCredential: suspend (String, String?, CredentialRequirement) -> CredentialResult,
) {
    /** Использует сохранённую сессию CLI/MCP и общий механизм обновления токенов. */
    public constructor(provider: CredentialProvider) : this(
        { apiUrl, env, requirement ->
            provider.resolve(
                CredentialRequest(
                    ProjectApiUrl(apiUrl),
                    null,
                    CredentialEnvName(env ?: "DSBUILDER_API_KEY"),
                    CredentialPolicy.AUTO,
                    requirement = requirement,
                ),
            )
        },
    )

    /** Использует активную сессию IDE; retry выполняет composition root IDE. */
    public constructor(resolver: UserSessionCredentialResolver) : this(
        { _, _, _ ->
            resolver.currentAccessToken()?.let { token ->
                CredentialResult.Selected(BackendCredential.Bearer(token), BackendCredentialType.USER_SESSION)
            } ?: CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Run dsbuilder auth login and retry.")
        },
    )

    /** Возвращает только пользовательскую авторизацию выбранного backend. */
    public suspend fun resolve(
        apiUrl: String,
        credentialEnvName: String? = null,
        requirement: CredentialRequirement = CredentialRequirement.AUTHENTICATED,
    ): CredentialResult = resolveCredential(apiUrl, credentialEnvName, requirement)
}
