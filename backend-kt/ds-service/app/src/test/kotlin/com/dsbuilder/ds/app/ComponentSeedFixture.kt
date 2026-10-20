package com.dsbuilder.ds.app

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID

/** Глобальный слой компонентов для интеграционных тестов: компоненты, свойства и параметры платформ из сида. */
internal object ComponentSeedFixture {
    /** Глобальные компоненты web и их свойства из сида: без них тема не получает компоненты дизайн-системы. */
    fun seed(postgres: PostgreSQLContainer<Nothing>): Map<String, UUID> =
        seed(postgres.jdbcUrl, postgres.username, postgres.password)

    /** Тот же полный каталог в отдельной БД сценария, созданной из мигрированного шаблона. */
    fun seed(jdbcUrl: String, username: String, password: String): Map<String, UUID> {
        val root = requireNotNull(javaClass.getResourceAsStream("/component-seeds.json"))
            .bufferedReader().use { Json.parseToJsonElement(it.readText()).jsonObject }
        val componentIds = linkedMapOf<String, UUID>()
        DriverManager.getConnection(jdbcUrl, username, password).use { connection ->
            root.getValue("components").jsonArray.forEach { element ->
                val component = element.jsonObject
                val componentName = component.getValue("name").jsonPrimitive.content
                val componentId = connection.prepareStatement(
                    "INSERT INTO components (name, description, platform) VALUES (?, '', 'web') RETURNING id",
                ).use { statement ->
                    statement.setString(1, componentName)
                    statement.executeQuery().use { rows ->
                        rows.next()
                        rows.getObject(1, UUID::class.java)
                    }
                }
                componentIds[componentName] = componentId
                val propertyNames = linkedSetOf<String>()
                component.getValue("propertyVariations").jsonArray.forEach {
                    propertyNames += it.jsonObject.getValue("property").jsonPrimitive.content
                }
                collectPropertyNames(component.getValue("appearances"), propertyNames)
                propertyNames.forEach { propertyName ->
                    val propertyId = connection.prepareStatement(
                        "INSERT INTO properties (component_id, name, type) " +
                            "VALUES (?, ?, 'value'::property_type) RETURNING id",
                    ).use { statement ->
                        statement.setObject(1, componentId)
                        statement.setString(2, propertyName)
                        statement.executeQuery().use { rows ->
                            rows.next()
                            rows.getObject(1, UUID::class.java)
                        }
                    }
                    val params = linkedSetOf<Pair<String, String>>()
                    collectAdjustments(component.getValue("appearances"), propertyName, params)
                    params.forEach { (platform, name) ->
                        connection.prepareStatement(
                            "INSERT INTO property_platform_params (property_id, platform, name) " +
                                "VALUES (?, ?::component_platform, ?)",
                        ).use { statement ->
                            statement.setObject(1, propertyId)
                            statement.setString(2, platform)
                            statement.setString(3, name)
                            statement.executeUpdate()
                        }
                    }
                }
            }
        }
        return componentIds
    }

    private fun collectPropertyNames(value: JsonElement, target: MutableSet<String>) {
        when (value) {
            is JsonArray -> value.forEach { collectPropertyNames(it, target) }
            is JsonObject -> {
                value["prop"]?.jsonPrimitive?.content?.let(target::add)
                value.values.forEach { collectPropertyNames(it, target) }
            }
            else -> Unit
        }
    }

    private fun collectAdjustments(
        value: JsonElement,
        propertyName: String,
        target: MutableSet<Pair<String, String>>,
        currentProperty: String? = null,
    ) {
        when (value) {
            is JsonArray -> value.forEach { collectAdjustments(it, propertyName, target, currentProperty) }
            is JsonObject -> {
                val property = value["prop"]?.jsonPrimitive?.content ?: currentProperty
                if (property == propertyName) {
                    value["adjust"]?.jsonArray?.forEach { adjustment ->
                        val entry = adjustment.jsonObject
                        target += entry.getValue("platform").jsonPrimitive.content to
                            entry.getValue("param").jsonPrimitive.content
                    }
                }
                value.values.forEach { collectAdjustments(it, propertyName, target, property) }
            }
            else -> Unit
        }
    }
}
