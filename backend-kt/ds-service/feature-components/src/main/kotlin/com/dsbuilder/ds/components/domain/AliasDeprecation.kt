package com.dsbuilder.ds.components.domain

/**
 * What the manifest says about the deprecation of a platform name.
 *
 * `Unknown` — the name came as a plain string: there is no information, the stored status is kept;
 * `Current` — the name came as an object without `deprecated`: the name is current, a mark is cleared;
 * `Deprecated` — the name is deprecated, the message may be empty.
 */
sealed interface AliasDeprecation {
    /** No information about deprecation. */
    data object Unknown : AliasDeprecation

    /** The name is explicitly not deprecated. */
    data object Current : AliasDeprecation

    /** The name is deprecated. */
    data class Deprecated(/** Message shown to users; may be empty. */ val message: String) : AliasDeprecation
}
