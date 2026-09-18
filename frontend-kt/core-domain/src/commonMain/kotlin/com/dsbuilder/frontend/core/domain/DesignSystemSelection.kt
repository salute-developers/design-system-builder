package com.dsbuilder.frontend.core.domain

/** How one request selected its design system. */
public enum class ContextProvenance {
    EXPLICIT_LINK,
    LOCAL_CONFIG,
}

/** Runtime credential choice. No secret is stored in this policy. */
public enum class CredentialPolicy {
    AUTO,
    USER_SESSION,
    PROJECT_KEY_ENV,
}

/**
 * Identity of one selected design system and publication target.
 * @property projectId project identifier.
 * @property designSystemId design-system identifier.
 * @property version publication version.
 * @property platform target platform.
 */
public data class DesignSystemSelection(
    public val projectId: ProjectId,
    public val designSystemId: DesignSystemId,
    public val version: String,
    public val platform: TargetPlatform,
) {
    init {
        require(version.isNotBlank()) { "Version must not be blank." }
    }
}

/**
 * Selection plus its source and credential policy for one invocation.
 * @property selection selected publication.
 * @property provenance selection source.
 * @property credentialPolicy chosen credential policy.
 * @property credentialEnvName environment variable containing a project key, if selected.
 * @property configPath local config path, if selected.
 */
public data class ResolvedDesignSystemContext(
    public val selection: DesignSystemSelection,
    public val provenance: ContextProvenance,
    public val credentialPolicy: CredentialPolicy,
    public val credentialEnvName: CredentialEnvName? = null,
    public val configPath: String? = null,
) {
    init {
        if (credentialPolicy == CredentialPolicy.PROJECT_KEY_ENV) {
            require(credentialEnvName != null) { "Project key env name is required." }
        }
        if (provenance == ContextProvenance.EXPLICIT_LINK) {
            require(configPath == null) { "Explicit selection cannot use a local config path." }
        }
    }
}
