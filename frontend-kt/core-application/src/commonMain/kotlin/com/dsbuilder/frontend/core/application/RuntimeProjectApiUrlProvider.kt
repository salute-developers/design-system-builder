package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.network.ApiUrlResolver

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
