package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ApiMetaAlias

/** Additive import of an API-meta manifest into the global component layer. */
data class ImportApiMeta(
    /** Platform of the manifest: a component is identified by its name and platform. */
    val platform: String,
    /** Reference file name of the meta (not a path). */
    val source: String,
    /** Whether the work is rolled back after the report is produced. */
    val dryRun: Boolean,
    /** Components carried by the manifest. */
    val components: List<Component>,
    /** Общие состояния, которые выражает генератор платформы; `null` — мета их не сообщила. */
    val interactionStates: List<String>? = null,
) {
    /** One component of the manifest. */
    data class Component(
        /** Component name. */
        val name: String,
        /** Properties of the component. */
        val properties: List<Property>,
        /** States declared by the component. */
        val states: List<String>,
    )

    /** One property of the manifest. */
    data class Property(
        /** Property name. */
        val name: String,
        /** Property type as sent by the client; checked against the stored type vocabulary. */
        val type: String,
        /** Platform names without repeats. */
        val aliases: List<ApiMetaAlias>,
        /** Optional description. */
        val description: String?,
        /** Признак поддержки состояний; `null` — манифест его не несёт, и признак не меняется. */
        val stateSupport: StateSupport? = null,
    )

    /** Признак поддержки состояний свойства манифеста: имена состояний и допустимость сочетаний. */
    data class StateSupport(
        /** Имена состояний; разрешаются в пределах компонента свойства. */
        val states: List<String>,
        /** Допускается ли сочетание нескольких состояний. */
        val combinations: Boolean,
    )
}
