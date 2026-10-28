package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.jdbc.batchInsert
import java.time.Instant
import java.util.UUID

/** Адрес начального значения темы. */
internal data class InitialValueKey(val tokenId: UUID, val platform: ThemeTokenPlatform?, val mode: ThemeTokenMode?)

/** Окончательное начальное значение с учётом профиля до первой записи в БД. */
internal data class InitialValuePayload(val paletteId: UUID?, val value: JsonElement?)

/** Пакетная запись новой темы сохраняет UUID, редакции и основу журнала в исходной транзакции создания. */
internal fun insertInitialTenantValues(
    tenantId: UUID,
    owner: UUID,
    boundary: UUID,
    sequence: Long,
    values: Map<InitialValueKey, InitialValuePayload>,
) {
    val now = Instant.now()
    values.entries.chunked(250).forEach { entries ->
        val rows = entries.map { Triple(UUID.randomUUID(), it.key, it.value) }
        ThemeTokenValuesTable.batchInsert(rows, shouldReturnGeneratedValues = false) { (id, key, _) ->
            this[ThemeTokenValuesTable.id] = id
            this[ThemeTokenValuesTable.designSystemId] = owner
            this[ThemeTokenValuesTable.tenantId] = tenantId
            this[ThemeTokenValuesTable.tokenId] = key.tokenId
            this[ThemeTokenValuesTable.platform] = key.platform
            this[ThemeTokenValuesTable.mode] = key.mode
            this[ThemeTokenValuesTable.createdAt] = now
        }
        ThemeTokenValueRevisionsTable.batchInsert(rows, shouldReturnGeneratedValues = false) { (entity, _, payload) ->
            this[ThemeTokenValueRevisionsTable.id] = UUID.randomUUID()
            this[ThemeTokenValueRevisionsTable.tokenValueId] = entity
            this[ThemeTokenValueRevisionsTable.designSystemId] = owner
            this[ThemeTokenValueRevisionsTable.designSystemVersionId] = boundary
            this[ThemeTokenValueRevisionsTable.versionSequenceNumber] = sequence
            this[ThemeTokenValueRevisionsTable.paletteId] = payload.paletteId
            this[ThemeTokenValueRevisionsTable.value] = payload.value
            this[ThemeTokenValueRevisionsTable.deleted] = false
            this[ThemeTokenValueRevisionsTable.updatedAt] = now
        }
        ThemeTokenValueCreationBaselinesTable.batchInsert(
            rows,
            shouldReturnGeneratedValues = false,
        ) { (entity, _, payload) ->
            this[ThemeTokenValueCreationBaselinesTable.designSystemVersionId] = boundary
            this[ThemeTokenValueCreationBaselinesTable.tokenValueId] = entity
            this[ThemeTokenValueCreationBaselinesTable.designSystemId] = owner
            this[ThemeTokenValueCreationBaselinesTable.paletteId] = payload.paletteId
            this[ThemeTokenValueCreationBaselinesTable.value] = payload.value
        }
    }
}
