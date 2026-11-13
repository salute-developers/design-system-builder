@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentDependencyGraph
import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.Serializable
import java.util.UUID

/** External bidirectional dependency graph. */
@Serializable
data class ComponentDependencyGraphResponse(
    /** As parent carried by this contract. */
    val asParent: List<WithChild>,
    /** As child carried by this contract. */
    val asChild: List<WithParent>,
) {
    /** Dependency row with the child relation. */
    @Serializable
    data class WithChild(
        /** Id carried by this contract. */
        val id: String,
        /** Parent id carried by this contract. */
        val parentId: String,
        /** Child id carried by this contract. */
        val childId: String,
        /** Type carried by this contract. */
        val type: String,
        /** Order carried by this contract. */
        val order: Int?,
        /** Created at carried by this contract. */
        val createdAt: String,
        /** Updated at carried by this contract. */
        val updatedAt: String,
        /** Child carried by this contract. */
        val child: ComponentResponse,
        /** Настройки переиспользования при явном include. */
        @EncodeDefault(EncodeDefault.Mode.NEVER)
        val reuseConfig: List<ComponentReuseConfigResponse>? = null,
    )

    /** Dependency row with the parent relation. */
    @Serializable
    data class WithParent(
        /** Id carried by this contract. */
        val id: String,
        /** Parent id carried by this contract. */
        val parentId: String,
        /** Child id carried by this contract. */
        val childId: String,
        /** Type carried by this contract. */
        val type: String,
        /** Order carried by this contract. */
        val order: Int?,
        /** Created at carried by this contract. */
        val createdAt: String,
        /** Updated at carried by this contract. */
        val updatedAt: String,
        /** Parent carried by this contract. */
        val parent: ComponentResponse,
        /** Настройки переиспользования при явном include. */
        @EncodeDefault(EncodeDefault.Mode.NEVER)
        val reuseConfig: List<ComponentReuseConfigResponse>? = null,
    )

    companion object {
        /** Performs the from operation. */
        fun from(
            value: ComponentDependencyGraph,
            reuseConfigs: Map<UUID, List<ComponentReuseConfig>>? = null,
        ) = ComponentDependencyGraphResponse(
            value.asParent.map {
                WithChild(
                    it.dependency.id.toString(),
                    it.dependency.parentId.toString(),
                    it.dependency.childId.toString(),
                    it.dependency.type.wireValue,
                    it.dependency.order,
                    it.dependency.createdAt.toString(),
                    it.dependency.updatedAt.toString(),
                    ComponentResponse.from(it.child),
                    reuseConfigs?.get(it.dependency.id).orEmpty().takeIf { reuseConfigs != null }
                        ?.map(ComponentReuseConfigResponse::from),
                )
            },
            value.asChild.map {
                WithParent(
                    it.dependency.id.toString(),
                    it.dependency.parentId.toString(),
                    it.dependency.childId.toString(),
                    it.dependency.type.wireValue,
                    it.dependency.order,
                    it.dependency.createdAt.toString(),
                    it.dependency.updatedAt.toString(),
                    ComponentResponse.from(it.parent),
                    reuseConfigs?.get(it.dependency.id).orEmpty().takeIf { reuseConfigs != null }
                        ?.map(ComponentReuseConfigResponse::from),
                )
            },
        )
    }
}
