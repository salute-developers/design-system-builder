package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.application.DesignSystemTokenInitializer
import com.dsbuilder.ds.core.application.DesignSystemTokenPlacementInitializer
import com.dsbuilder.ds.core.application.InitialTokenDefinition
import com.dsbuilder.ds.tokens.domain.TokenType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Создаёт определения токенов из канонического ресурса ds-service. */
class GeneratedTokenDefinitionInitializer(
    private val placements: DesignSystemTokenPlacementInitializer =
        DesignSystemTokenPlacementInitializer { _, _ -> emptyMap() },
) : DesignSystemTokenInitializer {
    override suspend fun initialize(designSystemId: UUID) {
        if (TokensTable.selectAll().where { TokensTable.designSystemId eq designSystemId }.limit(1).any()) return
        val baseline = TokenVersionBoundariesTable.selectAll().where {
            (TokenVersionBoundariesTable.designSystemId eq designSystemId) and
                (TokenVersionBoundariesTable.status eq TokenVersionBoundaryStatus.BASELINE)
        }.single()
        val initialPlacements = placements.initialize(
            designSystemId,
            definitions.map {
                InitialTokenDefinition(it.name, it.type.wireValue)
            },
        )
        definitions.chunked(250).forEach { definitions ->
            val tokens = definitions.map { UUID.randomUUID() to it }
            TokensTable.batchInsert(tokens, shouldReturnGeneratedValues = false) { (id, _) ->
                this[TokensTable.id] = id
                this[TokensTable.designSystemId] = designSystemId
            }
            TokenRevisionsTable.batchInsert(tokens, shouldReturnGeneratedValues = false) { (tokenId, definition) ->
                this[TokenRevisionsTable.tokenId] = tokenId
                this[TokenRevisionsTable.designSystemId] = designSystemId
                this[TokenRevisionsTable.designSystemVersionId] = baseline[TokenVersionBoundariesTable.id]
                this[TokenRevisionsTable.versionSequenceNumber] = baseline[TokenVersionBoundariesTable.sequenceNumber]
                this[TokenRevisionsTable.name] = definition.name
                this[TokenRevisionsTable.type] = definition.type
                this[TokenRevisionsTable.displayName] = definition.displayName
                this[TokenRevisionsTable.description] = definition.description
                this[TokenRevisionsTable.enabled] = definition.enabled
                this[TokenRevisionsTable.groupId] = initialPlacements[definition.name]?.groupId
                this[TokenRevisionsTable.position] = initialPlacements[definition.name]?.position ?: 0
                this[TokenRevisionsTable.deleted] = false
            }
        }
    }

    private val definitions: List<Definition> by lazy {
        val text = requireNotNull(
            javaClass.classLoader.getResourceAsStream("dsbuilder/ds/seeds/token-definitions.json"),
        ) {
            "Generated token definitions resource is missing"
        }.bufferedReader().use { it.readText() }
        Json.parseToJsonElement(text).jsonArray.mapNotNull { element ->
            val value = element.jsonObject
            val type = TokenType.fromWire(value.getValue("type").jsonPrimitive.content) ?: return@mapNotNull null
            Definition(
                value.getValue("name").jsonPrimitive.content,
                type,
                value.getValue("displayName").jsonPrimitive.content,
                value.getValue("description").jsonPrimitive.content,
                value.getValue("enabled").jsonPrimitive.content.toBoolean(),
            )
        }.distinctBy(Definition::name)
    }

    private data class Definition(
        val name: String,
        val type: TokenType,
        val displayName: String,
        val description: String,
        val enabled: Boolean,
    )
}
