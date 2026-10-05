package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.application.DesignSystemTokenInitializer
import com.dsbuilder.ds.tokens.domain.TokenType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Создаёт определения токенов из build-time ресурса исходного db-service. */
class GeneratedTokenDefinitionInitializer : DesignSystemTokenInitializer {
    override suspend fun initialize(designSystemId: UUID) {
        if (TokensTable.selectAll().where { TokensTable.designSystemId eq designSystemId }.limit(1).any()) return
        definitions.forEach { definition ->
            TokensTable.insert {
                it[TokensTable.designSystemId] = designSystemId
                it[name] = definition.name
                it[type] = definition.type
                it[displayName] = definition.displayName
                it[description] = definition.description
                it[enabled] = definition.enabled
            }
        }
    }

    private val definitions: List<Definition> by lazy {
        val text = requireNotNull(javaClass.classLoader.getResourceAsStream("token-definitions.json")) {
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
