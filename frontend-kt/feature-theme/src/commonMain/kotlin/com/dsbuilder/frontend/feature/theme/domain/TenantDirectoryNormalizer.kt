package com.dsbuilder.frontend.feature.theme.domain

/**
 * Строит deterministic filesystem-safe directory names для tenants.
 */
internal class TenantDirectoryNormalizer {
    fun normalize(tenants: List<Tenant>): List<TenantDirectory> {
        val bases = tenants.associateWith { tenant ->
            tenant.name
                .trim()
                .lowercase()
                .replace(Regex("[^a-z0-9._-]"), "_")
                .replace(Regex("_+"), "_")
                .trim('_')
                .ifBlank { tenant.id }
        }
        val duplicatedBases = bases.values
            .groupingBy { it }
            .eachCount()
            .filterValues { it > 1 }
            .keys

        return tenants.map { tenant ->
            val base = bases.getValue(tenant)
            val directoryName = if (base in duplicatedBases) {
                "${base}_${tenant.id.take(8)}"
            } else {
                base
            }
            TenantDirectory(tenant = tenant, directoryName = directoryName)
        }
    }
}
