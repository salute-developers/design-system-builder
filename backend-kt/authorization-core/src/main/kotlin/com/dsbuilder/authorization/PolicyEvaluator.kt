@file:Suppress("UndocumentedPublicProperty")

package com.dsbuilder.authorization

/** Pure permission evaluator. Resource ownership remains the responsibility of the owning service. */
class PolicyEvaluator(private val loaded: LoadedAuthorizationPolicy) {
    val policy: AuthorizationPolicy get() = loaded.policy
    val diagnostics: PolicyDiagnostics get() = loaded.diagnostics

    /** Evaluates a known permission using role grants, exact key scopes or the global admin override. */
    fun isAllowed(principal: ProjectPrincipal, permission: String): Boolean {
        if (permission !in policy.permissions || !principal.isValid(policy)) return false
        if (principal.type == ProjectActorType.USER && principal.systemAdmin) {
            return policy.overrides.systemAdmin.allowAll
        }
        return when (principal.type) {
            ProjectActorType.USER ->
                permission in loaded.effectiveRoleGrants[principal.projectRole?.lowercase()].orEmpty()
            ProjectActorType.PROJECT_KEY -> permission in principal.projectScopes
        }
    }

    /** Canonical exact scope catalog accepted when creating project keys. */
    fun projectKeyScopes(): Set<String> = policy.projectKeyScopes.toSet()
}
