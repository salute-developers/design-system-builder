package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.application.DraftOperationResult
import com.dsbuilder.frontend.core.application.DraftOperationRunner
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.network.HttpMutationResult

internal fun interface TokenEditDataSource {
    suspend fun read(runtime: RuntimeResolution.Resolved, tokenId: String, tenantId: String): HttpMutationResult
}

/** Читает исходные значения и редакции для подготовки точечной или семейной записи. */
public class ReadTokenEditDataUseCase internal constructor(
    resolver: RuntimeRequestResolver,
    private val remote: TokenEditDataSource,
) {
    private val runner = DraftOperationRunner(resolver)

    /** Ограничивает данные выбранными системой и темой, сохраняя исходную форму значений. */
    public suspend fun execute(
        tokenId: String,
        tenantId: String,
        version: String? = null,
        request: RuntimeRequest = RuntimeRequest(),
    ): DraftOperationResult =
        runner.read(version, request) { remote.read(it, tokenId, tenantId) }
}
