package com.dsbuilder.ds.components.domain

/** A platform name of a property together with what the manifest says about its deprecation. */
data class ApiMetaAlias(
    /** Platform name. */
    val name: String,
    /** Deprecation information. */
    val deprecation: AliasDeprecation,
) {
    companion object {
        /**
         * Merges repeated names: a name is deprecated when at least one occurrence is marked (the first
         * message wins), and "current" is stronger than "no information".
         */
        fun merge(aliases: List<ApiMetaAlias>): List<ApiMetaAlias> {
            val merged = linkedMapOf<String, ApiMetaAlias>()
            for (alias in aliases) {
                val known = merged[alias.name]
                when {
                    known == null -> merged[alias.name] = alias
                    known.deprecation is AliasDeprecation.Deprecated -> Unit
                    alias.deprecation is AliasDeprecation.Deprecated -> merged[alias.name] = alias
                    known.deprecation is AliasDeprecation.Unknown && alias.deprecation is AliasDeprecation.Current ->
                        merged[alias.name] = alias
                }
            }
            return merged.values.toList()
        }
    }
}
