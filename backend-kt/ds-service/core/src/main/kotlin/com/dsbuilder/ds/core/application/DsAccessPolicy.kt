package com.dsbuilder.ds.core.application

import com.dsbuilder.authorization.PolicyDiagnostics
import com.dsbuilder.authorization.PolicyEvaluator

/** Thin adapter from the shared authorization policy to DS application failures. */
class DsAccessPolicy(private val evaluator: PolicyEvaluator) {
    /** Safe immutable policy diagnostics exposed by readiness. */
    val diagnostics: PolicyDiagnostics
        get() = evaluator.diagnostics

    /** Returns success when [context] grants [permission], otherwise a closed denial. */
    fun require(context: DsRequestContext, permission: String): DsResult<Unit> =
        if (evaluator.isAllowed(context.principal, permission)) {
            DsResult.Success(Unit)
        } else {
            DsResult.Failure(DsFailure.Forbidden)
        }
}
