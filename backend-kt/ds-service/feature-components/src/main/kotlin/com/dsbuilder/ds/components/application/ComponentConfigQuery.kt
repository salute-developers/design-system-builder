package com.dsbuilder.ds.components.application

/** Lookup parameters for the legacy single component-config endpoint. */
data class ComponentConfigQuery(
    /** Design system name carried by this contract. */
    val designSystemName: String,
    /** Version carried by this contract. */
    val version: String,
    /** Appearance name carried by this contract. */
    val appearanceName: String,
    /** Component name carried by this contract. */
    val componentName: String,
    /** Platform of the component; a component is identified by its name and platform. */
    val platform: String,
)
