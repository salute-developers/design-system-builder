package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentConfig
import java.util.UUID

/** Atomic component configuration import command. */
data class ImportComponentConfig(
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Meta carried by this contract. */
    val meta: Meta,
    /** Dry run carried by this contract. */
    val dryRun: Boolean,
    /** Components carried by this contract. */
    val components: List<Entry>,
) {
    /** Package metadata recorded in the design-system change journal. */
    data class Meta(
        /** Name carried by this contract. */
        val name: String,
        /** Source carried by this contract. */
        val source: String,
    )

    /** One component and appearance configuration to import. */
    data class Entry(
        /** Component name carried by this contract. */
        val componentName: String,
        /** Style name carried by this contract. */
        val styleName: String,
        /** Config carried by this contract. */
        val config: ComponentConfig,
    )
}
