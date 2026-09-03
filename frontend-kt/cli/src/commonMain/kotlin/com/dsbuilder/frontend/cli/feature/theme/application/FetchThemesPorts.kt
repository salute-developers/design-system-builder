package com.dsbuilder.frontend.cli.feature.theme.application

import com.dsbuilder.frontend.cli.core.domain.ProjectApiKey
import com.dsbuilder.frontend.cli.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.cli.core.domain.ProjectContext
import com.dsbuilder.frontend.cli.feature.theme.domain.PaletteItem
import com.dsbuilder.frontend.cli.feature.theme.domain.Tenant
import com.dsbuilder.frontend.cli.feature.theme.domain.ThemeWritePlan
import com.dsbuilder.frontend.cli.feature.theme.domain.Token
import com.dsbuilder.frontend.cli.feature.theme.domain.TokenValue

internal interface RemoteThemeDataSource {
    fun fetchTenants(command: RemoteThemeCommand): RemoteThemeResult<List<Tenant>>

    fun fetchTokens(command: RemoteThemeCommand): RemoteThemeResult<List<Token>>

    fun fetchPalette(command: RemoteThemeCommand): RemoteThemeResult<List<PaletteItem>>

    fun fetchTokenValues(command: RemoteTenantThemeCommand): RemoteThemeResult<List<TokenValue>>
}

internal fun interface LocalThemeWriter {
    fun write(
        context: ProjectContext,
        writePlan: ThemeWritePlan,
    ): LocalThemeWriteResult
}

internal data class RemoteThemeCommand(
    val context: ProjectContext,
    val apiUrl: ProjectApiUrl,
    val apiKey: ProjectApiKey,
)

internal data class RemoteTenantThemeCommand(
    val context: ProjectContext,
    val apiUrl: ProjectApiUrl,
    val apiKey: ProjectApiKey,
    val tenantId: String,
)

internal sealed interface RemoteThemeResult<out T> {
    data class Success<T>(
        val value: T,
    ) : RemoteThemeResult<T>

    data class Failed(
        val message: String,
    ) : RemoteThemeResult<Nothing>
}

internal sealed interface LocalThemeWriteResult {
    data object Written : LocalThemeWriteResult

    data class Failed(
        val message: String,
    ) : LocalThemeWriteResult
}
