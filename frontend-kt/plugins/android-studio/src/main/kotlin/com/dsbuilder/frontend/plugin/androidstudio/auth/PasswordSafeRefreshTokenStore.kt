package com.dsbuilder.frontend.plugin.androidstudio.auth

import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe

private const val CREDENTIAL_USERNAME = "dsbuilder-studio-plugin"

private val credentialAttributes =
    CredentialAttributes(generateServiceName("DS Builder", "studio-plugin-refresh-token"))

/**
 * Хранит refresh token пользовательской OAuth-сессии через IntelliJ Platform `PasswordSafe`
 * (использует системный keychain/credential manager хост-ОС). Access token сюда не попадает —
 * он остаётся только в памяти [com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver].
 */
public class PasswordSafeRefreshTokenStore : RefreshTokenStore {
    override fun save(refreshToken: String) {
        PasswordSafe.instance.set(credentialAttributes, Credentials(CREDENTIAL_USERNAME, refreshToken))
    }

    override fun load(): String? = PasswordSafe.instance.get(credentialAttributes)?.getPasswordAsString()

    override fun clear() {
        PasswordSafe.instance.set(credentialAttributes, null)
    }
}
