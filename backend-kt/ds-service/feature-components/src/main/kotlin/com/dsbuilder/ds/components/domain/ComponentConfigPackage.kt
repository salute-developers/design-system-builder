package com.dsbuilder.ds.components.domain

/** Exported package containing canonical configurations for one design system. */
data class ComponentConfigPackage(
    /** Meta carried by this contract. */
    val meta: Meta,
    /** Components carried by this contract. */
    val components: List<Entry>,
    /** Underived types carried by this contract. */
    val underivedTypes: List<String>,
) {
    /** Package metadata. */
    data class Meta(
        /** Name carried by this contract. */
        val name: String,
        /** Version carried by this contract. */
        val version: String,
    )

    /** One component/style configuration in the package. */
    data class Entry(
        /** Component name carried by this contract. */
        val componentName: String,
        /** Style name carried by this contract. */
        val styleName: String,
        /** Config carried by this contract. */
        val config: ComponentConfig,
    )
}
