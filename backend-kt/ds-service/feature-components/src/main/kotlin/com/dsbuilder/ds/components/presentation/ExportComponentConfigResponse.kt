package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentConfigPackage
import kotlinx.serialization.Serializable

/** HTTP package produced by component-config export. */
@Serializable
data class ExportComponentConfigResponse(
    /** Meta carried by this contract. */
    val meta: Meta,
    /** Components carried by this contract. */
    val components: List<Entry>,
    /** Underived types carried by this contract. */
    val underivedTypes: List<String>,
) {
    /** Exported package metadata. */
    @Serializable
    data class Meta(
        /** Name carried by this contract. */
        val name: String,
        /** Version carried by this contract. */
        val version: String,
    )

    /** One exported component configuration. */
    @Serializable
    data class Entry(
        /** Component name carried by this contract. */
        val componentName: String,
        /** Style name carried by this contract. */
        val styleName: String,
        /** Config carried by this contract. */
        val config: ComponentConfigResponse,
    )

    companion object {
        /** Performs the from operation. */
        fun from(value: ComponentConfigPackage) = ExportComponentConfigResponse(
            Meta(value.meta.name, value.meta.version),
            value.components.map {
                Entry(it.componentName, it.styleName, ComponentConfigResponse.exported(it.config))
            },
            value.underivedTypes,
        )
    }
}
