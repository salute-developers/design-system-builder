package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult

internal suspend fun <T> DsAccessPolicy.read(
    context: DsRequestContext,
    permission: String,
    block: suspend () -> DsResult<T>,
): DsResult<T> = when (val allowed = require(context, permission)) {
    is DsResult.Failure -> allowed
    is DsResult.Success -> block()
}
