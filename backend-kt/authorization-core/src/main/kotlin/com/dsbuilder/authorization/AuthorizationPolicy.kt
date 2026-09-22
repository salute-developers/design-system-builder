@file:Suppress("UndocumentedPublicProperty")

package com.dsbuilder.authorization

import kotlinx.serialization.Serializable

/** Immutable machine-readable authorization policy. */
@Serializable
data class AuthorizationPolicy(
    val schemaVersion: String,
    val policyVersion: String,
    val permissions: List<String>,
    val roles: Map<String, RolePolicy>,
    val projectKeyScopes: List<String>,
    val overrides: PolicyOverrides,
)

/** Direct grants and parent roles for one project role. */
@Serializable
data class RolePolicy(
    val inherits: List<String>,
    val grants: List<String>,
)

/** Global policy overrides. */
@Serializable
data class PolicyOverrides(val systemAdmin: SystemAdminOverride)

/** `system_admin` is intentionally an explicit global override. */
@Serializable
data class SystemAdminOverride(val allowAll: Boolean)

/** Actor types accepted from the trusted Gateway context. */
@Serializable
enum class ProjectActorType { USER, PROJECT_KEY }

/** HTTP-independent representation of the trusted project actor context. */
@Serializable
data class ProjectPrincipal(
    val type: ProjectActorType,
    val actorId: String,
    val projectId: String,
    val projectRole: String? = null,
    val projectScopes: Set<String> = emptySet(),
    val systemAdmin: Boolean = false,
) {
    /** Rejects incomplete and contradictory trusted contexts. */
    fun isValid(policy: AuthorizationPolicy): Boolean = when (type) {
        ProjectActorType.USER ->
            actorId.isNotBlank() && projectId.isNotBlank() &&
                ((systemAdmin && projectRole == null) || projectRole?.lowercase() in policy.roles) &&
                projectScopes.isEmpty()
        ProjectActorType.PROJECT_KEY ->
            actorId.isNotBlank() && projectId.isNotBlank() && projectRole == null && !systemAdmin &&
                policy.projectKeyScopes.containsAll(projectScopes)
    }
}

/** Safe diagnostics for the immutable snapshot. */
data class PolicyDiagnostics(val policyVersion: String, val contentSha256: String)

/** Valid policy plus precomputed effective grants. */
class LoadedAuthorizationPolicy internal constructor(
    val policy: AuthorizationPolicy,
    val effectiveRoleGrants: Map<String, Set<String>>,
    val diagnostics: PolicyDiagnostics,
)
