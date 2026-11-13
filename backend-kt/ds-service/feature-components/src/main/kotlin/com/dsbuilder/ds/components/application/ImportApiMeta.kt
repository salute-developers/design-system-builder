package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ApiMetaAlias
import com.dsbuilder.ds.core.domain.CoreReleaseRef

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
    /** Координаты API; обязательны для релизного импорта. */
    val coreRelease: CoreReleaseRef? = null,
    /** Исходные байты файла в Base64 без повторной сериализации JSON. */
    val sourceMetaBase64: String? = null,
    /** SHA-256 исходных байтов файла. */
    val metaSha256: String? = null,
) {
    /** One component of the manifest. */
    data class Component(
        /** Component name. */
        val name: String,
        /** Properties of the component. */
        val properties: List<Property>,
        /** States declared by the component. */
        val states: List<String>,
        /** Описание компонента из меты, если производитель его предоставляет. */
        val description: String? = null,
        /** Только объявленная Core вложенность; пользовательские REUSE-связи сюда не входят. */
        val dependencies: List<Dependency> = emptyList(),
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
        /** Значение по умолчанию, объявленное Core. */
        val defaultValue: String? = null,
        /** Известные ограничения вложенного свойства, без догадок по пользовательским данным. */
        val componentTargets: List<String> = emptyList(),
    )

    /** Объявленная метой связь компонентов и её порядок. */
    data class Dependency(
        /** Имя вложенного компонента из того же релиза Core. */
        val component: String,
        /** Тип зависимости, объявленной Core: compose. */
        val type: String = "compose",
        /** Порядок вложенного компонента. */
        val order: Int? = null,
    )
}
