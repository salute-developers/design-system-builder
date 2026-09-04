package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.StructuredAdapterKey
import com.dsbuilder.documentation.processing.application.StructuredAdapterResult
import com.dsbuilder.documentation.processing.application.StructuredArtifactAdapter
import com.dsbuilder.documentation.publication.domain.CanonicalLexicalNormalizer
import com.dsbuilder.documentation.publication.domain.CodeBinding
import com.dsbuilder.documentation.publication.domain.CodeBindingKind
import com.dsbuilder.documentation.publication.domain.StructuredArtifact
import com.dsbuilder.documentation.publication.domain.StructuredArtifactType
import com.dsbuilder.documentation.publication.domain.StructuredLookupTerm
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

/** JSON adapter component info формата v1. */
class ComponentInfoJsonAdapter(
    override val key: StructuredAdapterKey,
    private val json: Json = strictJson(),
) : StructuredArtifactAdapter {
    override fun adapt(artifact: StructuredArtifact, sourceJson: String): StructuredAdapterResult {
        require(key.artifactType == StructuredArtifactType.COMPONENTS_INFO)
        val source = json.decodeFromString<ComponentInfoDto>(sourceJson)
        val grouped = source.components.groupBy(ComponentDto::key)
        val bindings = grouped.map { (componentKey, styles) ->
            require(componentKey.isNotBlank())
            require(styles.map(ComponentDto::coreName).distinct().size == 1)
            require(styles.all { style -> style.variations.all { it.name.isNotBlank() } })
            val coreName = styles.first().coreName
            CodeBinding(
                id = deterministicId(artifact.id, "component-style", componentKey),
                structuredArtifactId = artifact.id,
                publicationId = artifact.publicationId,
                subject = "components.$componentKey",
                kind = CodeBindingKind.COMPONENT_STYLE,
                name = coreName,
                platform = key.platform,
                platformPayload = json.encodeToString(ComponentBindingPayload(componentKey, coreName, styles)),
            )
        }
        return StructuredAdapterResult(
            bindings,
            bindings.flatMapIndexed { index, binding ->
                componentTerms(binding, grouped.values.elementAt(index))
            },
        )
    }
}

/** JSON adapter theme info формата v1. */
class ThemeInfoJsonAdapter(
    override val key: StructuredAdapterKey,
    private val json: Json = strictJson(),
) : StructuredArtifactAdapter {
    override fun adapt(artifact: StructuredArtifact, sourceJson: String): StructuredAdapterResult {
        require(key.artifactType == StructuredArtifactType.THEME_INFO)
        val source = json.decodeFromString<ThemeInfoDto>(sourceJson)
        val grouped = source.tokens.groupBy(ThemeTokenDto::name)
        val bindings = grouped.map { (tokenName, layers) ->
            require(tokenName.isNotBlank() && layers.all { it.type.isNotBlank() })
            require(layers.map(ThemeTokenDto::type).distinct().size == 1)
            require(layers.map(ThemeTokenDto::reference).distinct().size == 1)
            require(layers.map(ThemeTokenDto::themeReference).distinct().size == 1)
            val token = layers.first()
            CodeBinding(
                id = deterministicId(artifact.id, "token", tokenName),
                structuredArtifactId = artifact.id,
                publicationId = artifact.publicationId,
                subject = "tokens.$tokenName",
                kind = CodeBindingKind.TOKEN,
                name = token.displayName ?: tokenName,
                platform = key.platform,
                platformPayload = json.encodeToString(
                    ThemeTokenBindingPayload(
                        token.type,
                        tokenName,
                        token.displayName,
                        token.description,
                        layers.map(ThemeTokenDto::value),
                        token.reference,
                        token.themeReference,
                        token.tenant,
                        token.theme,
                    ),
                ),
            )
        }
        return StructuredAdapterResult(
            bindings,
            bindings.flatMapIndexed { index, binding ->
                tokenTerms(binding, grouped.values.elementAt(index).first())
            },
        )
    }
}

/** Создаёт registry всех поддерживаемых v1 formats. */
fun supportedStructuredArtifactAdapters(): List<StructuredArtifactAdapter> = listOf(
    componentAdapter("compose", "sdds-compose-components-info-v1"),
    themeAdapter("compose", "sdds-compose-theme-info-v1"),
    componentAdapter("android-view", "sdds-view-components-info-v1"),
    themeAdapter("android-view", "sdds-view-theme-info-v1"),
    componentAdapter("swiftui", "sdds-swiftui-components-info-v1"),
    themeAdapter("swiftui", "sdds-ios-theme-info-v1"),
)

private fun componentAdapter(platform: String, format: String) = ComponentInfoJsonAdapter(
    StructuredAdapterKey(platform, StructuredArtifactType.COMPONENTS_INFO, format),
)

private fun themeAdapter(platform: String, format: String) = ThemeInfoJsonAdapter(
    StructuredAdapterKey(platform, StructuredArtifactType.THEME_INFO, format),
)

private fun componentTerms(binding: CodeBinding, components: List<ComponentDto>): List<StructuredLookupTerm> {
    val terms = buildList {
        add("subject" to binding.subject)
        add("kind" to binding.kind.termValue())
        add("name" to binding.name)
        add("key" to components.first().key)
        components.forEach { component ->
            add("name" to component.styleName)
            component.styleApi?.let { api ->
                api.holderName?.let { add("holder" to it) }
                listOfNotNull(
                    api.stylesClassName,
                    api.receiverClassName,
                    api.returnTypeName,
                    api.modifyReceiverTypeName,
                ).forEach { add("class-name" to it) }
                listOfNotNull(
                    api.stylesClassQualifiedName,
                    api.receiverClassQualifiedName,
                    api.returnTypeQualifiedName,
                    api.modifyReceiverTypeQualifiedName,
                ).forEach { add("qualified-name" to it) }
                api.params.forEach { parameter ->
                    add("param-name" to parameter.name)
                    listOfNotNull(parameter.defaultValue).plus(parameter.values).forEach { value ->
                        add("param-value" to value.value)
                        value.codeName?.let { add("code-name" to it) }
                    }
                }
            }
            component.variations.forEach { variation ->
                add("variation" to variation.name)
                listOfNotNull(
                    variation.composeReference,
                    variation.viewReference,
                    variation.viewOverlayReference,
                    variation.reference,
                ).forEach { add("reference" to it) }
                variation.props.forEach { property -> add("param-value" to "${property.name}=${property.value}") }
            }
        }
    }
    return lookupTerms(binding.id, terms)
}

private fun tokenTerms(binding: CodeBinding, token: ThemeTokenDto): List<StructuredLookupTerm> = lookupTerms(
    binding.id,
    buildList {
        add("subject" to binding.subject)
        add("kind" to binding.kind.termValue())
        add("name" to token.name)
        token.displayName?.let { add("name" to it) }
        token.reference?.let { add("reference" to it) }
        token.themeReference?.let { add("reference" to it) }
    },
)

private fun CodeBindingKind.termValue(): String = name.lowercase().replace('_', '-')

private fun lookupTerms(bindingId: String, terms: List<Pair<String, String>>): List<StructuredLookupTerm> =
    terms.distinct().mapNotNull { (category, original) ->
        val canonical = CanonicalLexicalNormalizer.normalize(original) ?: return@mapNotNull null
        StructuredLookupTerm(
            id = deterministicId(bindingId, category, original),
            codeBindingId = bindingId,
            original = original,
            normalized = canonical.exact,
            category = category,
            tokenized = canonical.tokenText,
        )
    }

private fun deterministicId(vararg parts: String): String {
    val bytes = MessageDigest.getInstance("SHA-256")
        .digest(parts.joinToString("\u0000").toByteArray(StandardCharsets.UTF_8))
    return bytes.take(16).joinToString("") { byte -> "%02x".format(byte) }
}

private fun strictJson(): Json = Json {
    ignoreUnknownKeys = false
    explicitNulls = false
}
