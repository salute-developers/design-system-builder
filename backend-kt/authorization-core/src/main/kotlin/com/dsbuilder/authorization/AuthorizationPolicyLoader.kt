package com.dsbuilder.authorization

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

/** Fail-closed loader for an immutable policy snapshot. */
object AuthorizationPolicyLoader {
    private val json = Json { ignoreUnknownKeys = false }

    /** Loads a configured read-only path. Missing or invalid content throws. */
    fun load(path: Path): LoadedAuthorizationPolicy = loadBytes(Files.readAllBytes(path))

    /** Loads the canonical policy embedded in the authorization-core artifact. */
    fun loadEmbedded(): LoadedAuthorizationPolicy {
        val stream = AuthorizationPolicyLoader::class.java.getResourceAsStream(EMBEDDED_POLICY)
            ?: throw AuthorizationPolicyException("Embedded authorization policy is missing")
        return stream.use { loadBytes(it.readBytes()) }
    }

    /** Loads an external path when configured, otherwise the immutable embedded artifact. */
    fun load(configuredPath: String?): LoadedAuthorizationPolicy =
        configuredPath?.takeIf(String::isNotBlank)?.let { load(Path.of(it)) } ?: loadEmbedded()

    private fun loadBytes(bytes: ByteArray): LoadedAuthorizationPolicy {
        val policy = try {
            json.decodeFromString<AuthorizationPolicy>(bytes.decodeToString())
        } catch (error: SerializationException) {
            throw AuthorizationPolicyException("Authorization policy JSON is invalid", error)
        }
        val grants = AuthorizationPolicyValidator.validate(policy)
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        return LoadedAuthorizationPolicy(policy, grants, PolicyDiagnostics(policy.policyVersion, hash))
    }

    private const val EMBEDDED_POLICY = "/authorization/policy.json"
}

/** Startup-fatal policy validation error. */
class AuthorizationPolicyException(message: String, cause: Throwable? = null) : IllegalStateException(message, cause)

internal object AuthorizationPolicyValidator {
    fun validate(policy: AuthorizationPolicy): Map<String, Set<String>> {
        requirePolicy(policy.schemaVersion == SUPPORTED_SCHEMA, "Unsupported schemaVersion '${policy.schemaVersion}'")
        requirePolicy(policy.policyVersion.isNotBlank(), "policyVersion must not be blank")
        validateUnique("permissions", policy.permissions)
        validateUnique("projectKeyScopes", policy.projectKeyScopes)
        requirePolicy(policy.permissions.isNotEmpty(), "permissions must not be empty")
        requirePolicy(policy.roles.isNotEmpty(), "roles must not be empty")
        requirePolicy(policy.overrides.systemAdmin.allowAll, "system_admin override must allow all known permissions")

        val permissions = policy.permissions.toSet()
        policy.permissions.forEach { permission ->
            requirePolicy(PERMISSION_PATTERN.matches(permission), "Invalid permission '$permission'")
        }
        policy.projectKeyScopes.forEach { scope ->
            requirePolicy(scope in permissions, "Unknown project-key scope '$scope'")
        }
        policy.roles.forEach { (role, definition) ->
            requirePolicy(role.isNotBlank(), "Role name must not be blank")
            validateUnique("inherits for role '$role'", definition.inherits)
            validateUnique("grants for role '$role'", definition.grants)
            definition.inherits.forEach { parent ->
                requirePolicy(parent in policy.roles, "Role '$role' inherits unknown role '$parent'")
            }
            definition.grants.forEach { permission ->
                requirePolicy(permission in permissions, "Role '$role' grants unknown permission '$permission'")
            }
        }
        return effectiveGrants(policy)
    }

    private fun effectiveGrants(policy: AuthorizationPolicy): Map<String, Set<String>> {
        val memo = mutableMapOf<String, Set<String>>()
        val visiting = mutableSetOf<String>()
        fun visit(role: String): Set<String> {
            memo[role]?.let { return it }
            requirePolicy(visiting.add(role), "Role inheritance cycle contains '$role'")
            val definition = policy.roles.getValue(role)
            val grants = buildSet {
                addAll(definition.grants)
                definition.inherits.forEach { addAll(visit(it)) }
            }
            visiting.remove(role)
            memo[role] = grants
            return grants
        }
        policy.roles.keys.forEach(::visit)
        return memo.toMap()
    }

    private fun validateUnique(name: String, values: List<String>) =
        requirePolicy(values.size == values.toSet().size, "$name contains duplicates")

    private fun requirePolicy(value: Boolean, message: String) {
        if (!value) throw AuthorizationPolicyException(message)
    }

    private const val SUPPORTED_SCHEMA = "1"
    private val PERMISSION_PATTERN = Regex("^[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)+$")
}
