package com.dsbuilder.frontend.cli.core.data

import com.dsbuilder.frontend.cli.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.cli.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.cli.core.http.ApiUrlResolver

/**
 * Adapter resolution backend API URL из CLI args, env и code default.
 */
internal class RuntimeProjectApiUrlProvider(
    private val apiUrlResolver: ApiUrlResolver,
) : ProjectApiUrlProvider {
    override fun resolve(override: String?): ProjectApiUrl = ProjectApiUrl(
        value = apiUrlResolver.resolve(override).value,
    )
}
