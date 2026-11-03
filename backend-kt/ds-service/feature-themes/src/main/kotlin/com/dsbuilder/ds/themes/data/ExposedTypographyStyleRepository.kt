package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.TokenReferenceBinder
import com.dsbuilder.ds.core.application.TokenReferenceCleaner
import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.entityEditRevisions
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.lockDraftSubjects
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.typography.TypographyStyleLock
import com.dsbuilder.ds.themes.application.typography.TypographyStyleRepository
import com.dsbuilder.ds.themes.application.typography.TypographyTenant
import com.dsbuilder.ds.themes.application.typography.TypographyTokenLookup
import com.dsbuilder.ds.themes.application.typography.TypographyValueWrite
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyPlatformValues
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleNaming
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenChange
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import com.dsbuilder.ds.themes.domain.typography.TypographyValueRevision
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.jdbc.insert
import java.time.Instant
import java.util.UUID

/**
 * Exposed-хранилище стилей типографии поверх предметных редакций: определения — `token_revisions`, значения —
 * `token_value_revisions` на границе транзакции, технические редакции — `entity_edit_states`.
 */
class ExposedTypographyStyleRepository(
    private val referenceCleaners: List<TokenReferenceCleaner> = emptyList(),
    private val referenceBinders: List<TokenReferenceBinder> = emptyList(),
) : TypographyStyleRepository {
    override suspend fun tenant(projectId: ProjectId, tenantId: UUID): TypographyTenant? =
        currentTenantRows(projectId, tenantId = tenantId).singleOrNull()
            ?.takeIf { it[ThemeDesignSystemsTable.projectId] == projectId.value }
            ?.let { row -> TypographyTenant(row[TenantsTable.designSystemId]) }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID): TypographyStyleLock {
        val tenant = tenant(projectId, tenantId) ?: return TypographyStyleLock.NotFound
        lockDesignSystemMutation(tenant.designSystemId)
        return TypographyStyleLock.Locked(tenant.designSystemId)
    }

    override suspend fun token(designSystemId: UUID, tokenId: UUID): TypographyTokenLookup =
        currentThemeTokenRows(designSystemId, setOf(tokenId)).singleOrNull()
            ?.let { row ->
                TypographyTokenLookup.Found(row[ThemeTokenRevisionsTable.name], row[ThemeTokenRevisionsTable.type])
            }
            ?: TypographyTokenLookup.Missing

    override suspend fun styles(
        designSystemId: UUID,
        tenantId: UUID,
        style: TypographyStyleKey?,
    ): List<StoredTypographyToken> {
        val tokens = styleTokens(designSystemId, style)
        val values = values(designSystemId, tenantId, tokens.keys)
        return tokens.map { (id, name) ->
            val stored = values[id].orEmpty()
            StoredTypographyToken(id, name, stored.mapValues { it.value.value }, stored.values.map { it.revision })
        }
    }

    override suspend fun lockStyle(
        designSystemId: UUID,
        tenantId: UUID,
        style: TypographyStyleKey,
    ): List<StoredTypographyToken> {
        val valueIds = styles(designSystemId, tenantId, style).flatMap { token -> token.revisions.map { it.valueId } }
        check(lockDraftSubjects(designSystemId, TOKEN_VALUE, valueIds))
        return styles(designSystemId, tenantId, style)
    }

    override suspend fun families(designSystemId: UUID, tenantId: UUID): List<TypographyFamily> {
        val tokens = currentThemeTokenRows(designSystemId)
            .filter { it[ThemeTokenRevisionsTable.type] == ThemeTokenType.FONT_FAMILY }
            .associate { row -> row[ThemeTokensTable.id] to row[ThemeTokenRevisionsTable.name] }
        val values = values(designSystemId, tenantId, tokens.keys)
        return tokens.map { (id, name) ->
            val platforms = values[id].orEmpty()
            val fontName = sequenceOf(ThemeTokenPlatform.WEB, ThemeTokenPlatform.ANDROID, ThemeTokenPlatform.IOS)
                .mapNotNull { platform -> platforms[platform]?.value }
                .mapNotNull { value -> TypographyPlatformValues.objectOf(value)["name"] as? JsonPrimitive }
                .mapNotNull { it.contentOrNull }
                .firstOrNull()
                .orEmpty()
            TypographyFamily(name.removePrefix(TypographyPlatformValues.FONT_FAMILY_PREFIX), fontName)
        }.sortedBy { FAMILY_ORDER.indexOf(it.name).takeIf { index -> index >= 0 } ?: FAMILY_ORDER.size }
    }

    override suspend fun themeCount(designSystemId: UUID): Int = currentTenantRows(designSystemId = designSystemId).size

    override suspend fun writeValues(designSystemId: UUID, values: List<TypographyValueWrite>) {
        if (values.isEmpty()) return
        val ids = values.mapTo(hashSetOf()) { it.valueId }
        val current = currentThemeTokenValueRows(designSystemId)
            .filter { row -> row[ThemeTokenValuesTable.id] in ids }
            .associateBy { row -> row[ThemeTokenValuesTable.id] }
        values.sortedBy { it.valueId }.forEach { write ->
            val row = current[write.valueId]
            writeThemeValueRevision(
                entity = write.valueId,
                owner = designSystemId,
                palette = row?.get(ThemeTokenValueRevisionsTable.paletteId),
                data = write.value,
                overridden = row?.get(ThemeTokenValueRevisionsTable.overridden) ?: false,
                paths = setOf("/value"),
                baseRevision = write.baseRevision,
            )
        }
    }

    override suspend fun tokenNames(designSystemId: UUID): Set<String> =
        currentThemeTokenRows(designSystemId).mapTo(hashSetOf()) { row ->
            row[ThemeTokenRevisionsTable.name].trim().lowercase()
        }

    override suspend fun createStyle(
        designSystemId: UUID,
        sources: Map<TypographyTokenName, UUID>,
        family: String?,
    ): Map<TypographyTokenName, UUID> {
        val tenants = currentTenantRows(designSystemId = designSystemId).mapTo(sortedSetOf()) { it[TenantsTable.id] }
        val values = currentThemeTokenValueRows(designSystemId, tenants, sources.values.toSet())
            .filter { it[ThemeTokenValuesTable.mode] == null && it[ThemeTokenValuesTable.platform] != null }
            .groupBy { it[ThemeTokenValuesTable.tokenId] }
        // Новые адреса не имеют путей, поэтому базовая редакция запроса не даёт предупреждений, а метаданные
        // перечисляют созданные определения и значения, как у создания токенов размеров.
        return sources.entries.sortedBy { it.key.toString() }.associate { (name, source) ->
            val entity = UUID.randomUUID()
            ThemeTokensTable.insert {
                it[id] = entity
                it[ThemeTokensTable.designSystemId] = designSystemId
                it[createdAt] = Instant.now()
            }
            writeThemeTokenRevision(entity, designSystemId, payload(name), setOf("/"))
            values[source].orEmpty()
                .sortedWith(compareBy({ it[ThemeTokenValuesTable.tenantId] }, { it[ThemeTokenValuesTable.platform] }))
                .forEach { row ->
                    val platform = requireNotNull(row[ThemeTokenValuesTable.platform])
                    val value = row[ThemeTokenValueRevisionsTable.value]
                    writeThemeValueRevision(
                        entity = stableThemeValue(
                            designSystemId,
                            row[ThemeTokenValuesTable.tenantId],
                            entity,
                            platform,
                        ),
                        owner = designSystemId,
                        palette = null,
                        data = if (family != null && value != null) {
                            TypographyPlatformValues.write(value, platform, TypographyTokenChange(fontFamily = family))
                        } else {
                            value
                        },
                        paths = setOf("/"),
                        overridden = row[ThemeTokenValueRevisionsTable.overridden],
                    )
                }
            name to entity
        }
    }

    override suspend fun renameStyle(
        designSystemId: UUID,
        names: Map<UUID, TypographyTokenName>,
        references: Map<UUID, Set<UUID>>,
    ) {
        bind(designSystemId, references)
        names.toSortedMap().forEach { (token, name) ->
            reviseThemeToken(token, setOf("/name", "/display_name", "/description")) {
                it.copy(
                    name = name.toString(),
                    displayName = TypographyStyleNaming.displayName(name),
                    description = TypographyStyleNaming.description(name),
                )
            }
        }
    }

    override suspend fun deleteStyle(designSystemId: UUID, tokenIds: Set<UUID>, references: Map<UUID, Set<UUID>>) {
        if (tokenIds.isEmpty()) return
        // Текстовые ссылки на стиль и ссылки комбинаций по `token_id` (их текст повторяет имя стиля) становятся
        // пустыми; остальные ссылки по `token_id` очищает общий механизм удаления.
        val texts = references.values.flatten().toSet()
        referenceBinders.forEach {
            it.detach(designSystemId, texts)
            it.detachCombinations(designSystemId, tokenIds)
        }
        // Редакция удаляемого определения не является базовой редакцией каждого зависимого значения и ссылки.
        SubjectMutationPaths.withoutBaseComparison {
            referenceCleaners.forEach { it.clear(designSystemId, tokenIds) }
            deleteThemeValues(tokenIds)
        }
        tokenIds.sorted().forEach { token -> reviseThemeToken(token, setOf("/deleted")) { it.copy(deleted = true) } }
    }

    /** Привязывает текстовые ссылки компонентов к токенам по `token_id`: токен → строки значений. */
    private suspend fun bind(designSystemId: UUID, references: Map<UUID, Set<UUID>>) =
        references.toSortedMap().forEach { (token, rows) ->
            referenceBinders.forEach { it.bind(designSystemId, token, rows) }
        }

    /** Определение нового токена стиля по правилу сида. */
    private fun payload(name: TypographyTokenName) = ThemeTokenPayload(
        name = name.toString(),
        type = ThemeTokenType.TYPOGRAPHY,
        displayName = TypographyStyleNaming.displayName(name),
        description = TypographyStyleNaming.description(name),
        enabled = true,
        groupId = null,
        position = 0,
    )

    /** Токены стилей дизайн-системы на границе: идентификатор → разобранное имя. */
    private fun styleTokens(designSystemId: UUID, style: TypographyStyleKey?): Map<UUID, TypographyTokenName> =
        currentThemeTokenRows(designSystemId)
            .filter { it[ThemeTokenRevisionsTable.type] == ThemeTokenType.TYPOGRAPHY }
            .mapNotNull { row ->
                TypographyTokenName.parse(row[ThemeTokenRevisionsTable.name])
                    ?.takeIf { name -> style == null || name.style == style }
                    ?.let { name -> row[ThemeTokensTable.id] to name }
            }
            .toMap()

    /**
     * Значения платформ без режима — так хранятся типографика и семейства: токен → платформа → значение и его
     * техническая редакция на границе транзакции.
     */
    private fun values(
        designSystemId: UUID,
        tenantId: UUID,
        tokenIds: Collection<UUID>,
    ): Map<UUID, Map<ThemeTokenPlatform, StoredValue>> {
        if (tokenIds.isEmpty()) return emptyMap()
        val rows = currentThemeTokenValueRows(designSystemId, setOf(tenantId), tokenIds.toSet())
            .filter { it[ThemeTokenValuesTable.mode] == null }
        val revisions = rows.groupBy { it[ThemeVersionBoundariesTable.id] }
            .flatMap { (boundary, boundaryRows) ->
                entityEditRevisions(
                    boundary,
                    TOKEN_VALUE,
                    boundaryRows.mapTo(hashSetOf()) { it[ThemeTokenValuesTable.id] },
                ).entries
            }
            .associate { it.key to it.value }
        return rows.mapNotNull { row -> stored(row, revisions) }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, items) -> items.associateBy { it.revision.platform } }
    }

    private fun stored(row: ResultRow, revisions: Map<UUID, Long>): Pair<UUID, StoredValue>? {
        val platform = row[ThemeTokenValuesTable.platform] ?: return null
        val value = row[ThemeTokenValueRevisionsTable.value] ?: return null
        val id = row[ThemeTokenValuesTable.id]
        return row[ThemeTokenValuesTable.tokenId] to
            StoredValue(value, TypographyValueRevision(platform, id, revisions[id] ?: 0))
    }

    private data class StoredValue(val value: JsonElement, val revision: TypographyValueRevision)

    private companion object {
        const val TOKEN_VALUE = "token-value"
        val FAMILY_ORDER = listOf("display", "header", "body", "text")
    }
}
