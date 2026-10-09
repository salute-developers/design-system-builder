package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ApiMetaRepository
import com.dsbuilder.ds.components.application.ImportApiMeta
import com.dsbuilder.ds.components.domain.AliasDeprecation
import com.dsbuilder.ds.components.domain.ApiMetaAlias
import com.dsbuilder.ds.components.domain.ApiMetaImportReport
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.util.UUID

/**
 * Additive API-meta import over the global component layer.
 *
 * A component is identified by `(name, platform)`: components of other platforms are neither read
 * nor changed. Existing rows are never changed or removed; the only thing the import updates is the
 * deprecation status of a platform name (set, message changed, cleared). The type of an existing
 * property is reported when it differs but is never rewritten, and an unknown type rejects the
 * property, not the request.
 */
internal class ExposedApiMetaRepository : ApiMetaRepository {
    override suspend fun import(actorId: String, command: ImportApiMeta): ApiMetaRepository.ImportAttempt =
        runCatching { ApiMetaRepository.ImportAttempt.Success(importMeta(actorId, command)) }
            .getOrElse { ApiMetaRepository.ImportAttempt.Failed(it.message ?: it.toString()) }

    private fun importMeta(actorId: String, command: ImportApiMeta): ApiMetaImportReport {
        val platform = requireNotNull(ComponentPlatformDb.fromWire(command.platform))
        val counters = Counters()
        val components = merge(command.components, counters.rejected)
        val names = components.map(MergedComponent::name)
        val componentIds = ensureComponents(platform, names, counters)
        val ids = componentIds.values.toList()
        ensureStates(components, componentIds, counters)
        val properties = ensureProperties(components, componentIds, ids, counters)
        ensureAliases(platform, properties.aliasRows, counters)
        val report = counters.toReport(absent(platform, components, componentIds, properties.existing))
        journal(actorId, command, report)
        return report
    }

    private fun ensureComponents(
        platform: ComponentPlatformDb,
        names: List<String>,
        counters: Counters,
    ): Map<String, UUID> {
        fun load(part: List<String>) = ComponentsTable.selectAll()
            .where { (ComponentsTable.platform eq platform) and (ComponentsTable.name inList part) }
            .associate { it[ComponentsTable.name] to it[ComponentsTable.id] }

        val ids = linkedMapOf<String, UUID>()
        names.chunked(CHUNK_SIZE).forEach { ids += load(it) }
        names.filter { it !in ids }.forEach { name ->
            val inserted = ComponentsTable.insertIgnore {
                it[ComponentsTable.name] = name
                it[ComponentsTable.platform] = platform
                it[description] = COMPONENT_DESCRIPTION
            }
            counters.createdComponents += inserted.insertedCount
        }
        // A row created concurrently between the read and the insert is ignored by the insert: read it back.
        names.filter { it !in ids }.chunked(CHUNK_SIZE).forEach { ids += load(it) }
        return ids
    }

    private fun ensureStates(
        components: List<MergedComponent>,
        componentIds: Map<String, UUID>,
        counters: Counters,
    ) {
        val existing = hashSetOf<Pair<UUID, String>>()
        componentIds.values.toList().chunked(CHUNK_SIZE).forEach { part ->
            ComponentStatesTable.selectAll().where { ComponentStatesTable.componentId inList part }
                .forEach { row ->
                    existing += requireNotNull(row[ComponentStatesTable.componentId]) to row[ComponentStatesTable.name]
                }
        }
        components.forEach { component ->
            val componentId = componentIds[component.name] ?: return@forEach
            component.states.filter { (componentId to it) !in existing }.forEach { state ->
                counters.createdStates += ComponentStatesTable.insertIgnore {
                    it[ComponentStatesTable.componentId] = componentId
                    it[name] = state
                }.insertedCount
            }
        }
    }

    private fun existingProperties(ids: List<UUID>): Map<Pair<UUID, String>, StoredProperty> {
        val result = linkedMapOf<Pair<UUID, String>, StoredProperty>()
        ids.chunked(CHUNK_SIZE).forEach { part ->
            PropertiesTable.selectAll().where { PropertiesTable.componentId inList part }.forEach { row ->
                val componentId = row[PropertiesTable.componentId] ?: return@forEach
                result[componentId to row[PropertiesTable.name]] =
                    StoredProperty(row[PropertiesTable.id], row[PropertiesTable.type].wireValue, componentId)
            }
        }
        return result
    }

    private fun ensureProperties(
        components: List<MergedComponent>,
        componentIds: Map<String, UUID>,
        ids: List<UUID>,
        counters: Counters,
    ): Properties {
        val existing = existingProperties(ids)
        val supported = PropertyTypeDb.entries.mapTo(hashSetOf()) { it.wireValue }
        val candidates = mutableListOf<AliasCandidate>()
        components.forEach { component ->
            val componentId = componentIds[component.name] ?: return@forEach
            component.properties.forEach { property ->
                val stored = existing[componentId to property.name]
                val candidate = AliasCandidate(componentId, property.name, property.aliases)
                if (writeProperty(component.name, componentId, property, stored, supported, counters)) {
                    candidates += candidate
                }
            }
        }
        val after = existingProperties(ids)
        return Properties(existing, candidates.flatMap { it.resolve(after) })
    }

    /** Writes one property; returns false when it was rejected and so has no platform names to write. */
    private fun writeProperty(
        componentName: String,
        componentId: UUID,
        property: ImportApiMeta.Property,
        stored: StoredProperty?,
        supported: Set<String>,
        counters: Counters,
    ): Boolean {
        when {
            stored != null && stored.type == property.type -> counters.unchangedProperties++
            stored != null ->
                counters.typeMismatches +=
                    "$componentName.${property.name}: db=${stored.type}, meta=${property.type}"
            property.type !in supported -> {
                counters.rejected += ApiMetaImportReport.Rejection(
                    componentName,
                    property.name,
                    "unknown property type: ${property.type}",
                )
                return false
            }
            else -> counters.createdProperties += PropertiesTable.insertIgnore {
                it[PropertiesTable.componentId] = componentId
                it[name] = property.name
                it[type] = requireNotNull(PropertyTypeDb.fromWire(property.type))
                it[description] = property.description?.takeIf(String::isNotEmpty)
            }.insertedCount
        }
        return true
    }

    private fun ensureAliases(
        platform: ComponentPlatformDb,
        rows: List<AliasRow>,
        counters: Counters,
    ) {
        val stored = hashMapOf<Pair<UUID, String>, StoredAlias>()
        rows.map(AliasRow::propertyId).distinct().chunked(CHUNK_SIZE).forEach { part ->
            PropertyPlatformParamsTable.selectAll().where {
                (PropertyPlatformParamsTable.platform eq platform) and
                    (PropertyPlatformParamsTable.propertyId inList part)
            }.forEach { row ->
                val key = row[PropertyPlatformParamsTable.propertyId] to row[PropertyPlatformParamsTable.name]
                stored[key] = StoredAlias(
                    row[PropertyPlatformParamsTable.id],
                    row[PropertyPlatformParamsTable.deprecated],
                    row[PropertyPlatformParamsTable.deprecatedMessage],
                )
            }
        }
        rows.forEach { row -> applyAlias(platform, row, stored[row.propertyId to row.name], counters) }
    }

    private fun applyAlias(platform: ComponentPlatformDb, row: AliasRow, known: StoredAlias?, counters: Counters) {
        val deprecation = row.deprecation
        if (known == null) {
            val deprecated = deprecation is AliasDeprecation.Deprecated
            val inserted = PropertyPlatformParamsTable.insertIgnore {
                it[propertyId] = row.propertyId
                it[PropertyPlatformParamsTable.platform] = platform
                it[name] = row.name
                it[PropertyPlatformParamsTable.deprecated] = deprecated
                it[deprecatedMessage] = (deprecation as? AliasDeprecation.Deprecated)?.message
            }.insertedCount
            counters.createdAliases += inserted
            if (deprecated) counters.deprecatedMarked += inserted
            return
        }
        // Existing name: only the deprecation status changes.
        when {
            deprecation is AliasDeprecation.Deprecated -> {
                when {
                    !known.deprecated -> counters.deprecatedMarked++
                    known.message != deprecation.message -> counters.deprecatedMessageChanged++
                    else -> return
                }
                setDeprecation(known.id, true, deprecation.message)
            }
            deprecation is AliasDeprecation.Current && known.deprecated -> {
                counters.deprecatedCleared++
                setDeprecation(known.id, false, null)
            }
        }
    }

    private fun setDeprecation(id: UUID, deprecated: Boolean, message: String?) {
        PropertyPlatformParamsTable.update({ PropertyPlatformParamsTable.id eq id }) {
            it[PropertyPlatformParamsTable.deprecated] = deprecated
            it[deprecatedMessage] = message
        }
    }

    /** For information only: stored for the platform but absent from the meta. */
    private fun absent(
        platform: ComponentPlatformDb,
        components: List<MergedComponent>,
        componentIds: Map<String, UUID>,
        stored: Map<Pair<UUID, String>, StoredProperty>,
    ): List<String> {
        val inMeta = components.mapTo(hashSetOf(), MergedComponent::name)
        val result = ComponentsTable.selectAll().where { ComponentsTable.platform eq platform }
            .map { it[ComponentsTable.name] }.filter { it !in inMeta }.toMutableList()
        val nameById = componentIds.entries.associate { it.value to it.key }
        val manifestProperties = components.flatMapTo(hashSetOf()) { c -> c.properties.map { "${c.name}.${it.name}" } }
        stored.forEach { (key, _) ->
            val componentName = nameById[key.first] ?: return@forEach
            if ("$componentName.${key.second}" !in manifestProperties) result += "$componentName.${key.second}"
        }
        return result.sorted()
    }

    private fun journal(actorId: String, command: ImportApiMeta, report: ApiMetaImportReport) {
        DesignSystemChangesTable.insertReturning {
            it[designSystemId] = null
            it[entityType] = "components:import-api-meta"
            // A global operation has no entity of its own and the column is mandatory: the run id.
            it[entityId] = UUID.randomUUID()
            it[operation] = if (report.createdComponents + report.createdProperties > 0) {
                ComponentChangeOperationDb.CREATED
            } else {
                ComponentChangeOperationDb.UPDATED
            }
            it[data] = buildJsonObject {
                put("userId", actorId)
                put("platform", command.platform)
                put("source", command.source.substringAfterLast('/').substringAfterLast('\\'))
                put("dryRun", command.dryRun)
                put("createdComponents", report.createdComponents)
                put("createdProperties", report.createdProperties)
                put("createdStates", report.createdStates)
                put("createdAliases", report.createdAliases)
                put("unchangedProperties", report.unchangedProperties)
                put("deprecatedMarked", report.deprecatedMarked)
                put("deprecatedMessageChanged", report.deprecatedMessageChanged)
                put("deprecatedCleared", report.deprecatedCleared)
                put(
                    "rejected",
                    JsonArray(
                        report.rejected.map {
                            buildJsonObject {
                                put("component", it.component)
                                put("property", it.property)
                                put("reason", it.reason)
                            }
                        },
                    ),
                )
                put("typeMismatches", JsonArray(report.typeMismatches.map(::JsonPrimitive)))
                // The list can be long and is only needed in the response: the journal keeps its size.
                put("absentCount", report.absent.size)
            }
        }.single()
    }

    /**
     * Collapses repeats of one component and one property.
     *
     * The first occurrence wins, a repeat with a contradicting type is rejected, and the platform
     * names of a repeat with the same type are added to those of the first occurrence.
     */
    private fun merge(
        components: List<ImportApiMeta.Component>,
        rejected: MutableList<ApiMetaImportReport.Rejection>,
    ): List<MergedComponent> {
        val properties = linkedMapOf<String, MutableList<ImportApiMeta.Property>>()
        val states = linkedMapOf<String, MutableList<String>>()
        components.forEach { component ->
            properties.getOrPut(component.name, ::mutableListOf) += component.properties
            states.getOrPut(component.name, ::mutableListOf) += component.states
        }
        return properties.map { (name, source) ->
            val merged = linkedMapOf<String, ImportApiMeta.Property>()
            source.forEach { property ->
                val known = merged[property.name]
                when {
                    known == null -> merged[property.name] = property
                    known.type != property.type -> rejected += ApiMetaImportReport.Rejection(
                        name,
                        property.name,
                        "duplicate property with a different type: ${known.type} and ${property.type}",
                    )
                    else -> merged[property.name] =
                        known.copy(aliases = ApiMetaAlias.merge(known.aliases + property.aliases))
                }
            }
            MergedComponent(name, merged.values.toList(), states.getValue(name).distinct())
        }
    }

    private class MergedComponent(
        val name: String,
        val properties: List<ImportApiMeta.Property>,
        val states: List<String>,
    )

    private class StoredProperty(val id: UUID, val type: String, val componentId: UUID)

    private class StoredAlias(val id: UUID, val deprecated: Boolean, val message: String?)

    private class AliasCandidate(val componentId: UUID, val propertyName: String, val aliases: List<ApiMetaAlias>) {
        fun resolve(properties: Map<Pair<UUID, String>, StoredProperty>): List<AliasRow> =
            properties[componentId to propertyName]?.let { stored ->
                aliases.map { AliasRow(stored.id, it.name, it.deprecation) }
            }.orEmpty()
    }

    private class AliasRow(val propertyId: UUID, val name: String, val deprecation: AliasDeprecation)

    private class Properties(
        val existing: Map<Pair<UUID, String>, StoredProperty>,
        val aliasRows: List<AliasRow>,
    )

    private class Counters {
        var createdComponents = 0
        var createdProperties = 0
        var createdStates = 0
        var createdAliases = 0
        var unchangedProperties = 0
        var deprecatedMarked = 0
        var deprecatedMessageChanged = 0
        var deprecatedCleared = 0
        val rejected = mutableListOf<ApiMetaImportReport.Rejection>()
        val typeMismatches = mutableListOf<String>()

        fun toReport(absent: List<String>) = ApiMetaImportReport(
            createdComponents,
            createdProperties,
            createdStates,
            createdAliases,
            unchangedProperties,
            deprecatedMarked,
            deprecatedMessageChanged,
            deprecatedCleared,
            rejected.toList(),
            typeMismatches.toList(),
            absent,
        )
    }

    private companion object {
        const val CHUNK_SIZE = 1000
        const val COMPONENT_DESCRIPTION = "Imported from api-meta"
    }
}
