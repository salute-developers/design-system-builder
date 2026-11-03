package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl

/** Авторизация каталогов строго от имени пользователя без чтения project key. */
public class UserSessionAccess private constructor(
    private val resolveCredential: suspend (String) -> CredentialResult,
) {
    /** Использует сохранённую сессию CLI/MCP и общий механизм обновления токенов. */
    public constructor(provider: CredentialProvider) : this(
        { apiUrl ->
            provider.resolve(
                CredentialRequest(
                    ProjectApiUrl(apiUrl),
                    null,
                    CredentialEnvName("DSBUILDER_API_KEY"),
                    CredentialPolicy.USER_SESSION,
                ),
            )
        },
    )

    /** Использует активную сессию IDE; retry выполняет composition root IDE. */
    public constructor(resolver: UserSessionCredentialResolver) : this(
        {
            resolver.currentAccessToken()?.let { token ->
                CredentialResult.Selected(BackendCredential.Bearer(token), BackendCredentialType.USER_SESSION)
            } ?: CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Run dsbuilder auth login and retry.")
        },
    )

    /** Возвращает только пользовательскую авторизацию выбранного backend. */
    public suspend fun resolve(apiUrl: String): CredentialResult = resolveCredential(apiUrl)
}
