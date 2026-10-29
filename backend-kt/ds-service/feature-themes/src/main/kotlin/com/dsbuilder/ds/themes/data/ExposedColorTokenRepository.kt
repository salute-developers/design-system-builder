package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.TokenReferenceCleaner
import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.entityEditRevisions
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.lockDraftSubjects
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenLock
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenLookup
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenValue
import com.dsbuilder.ds.themes.application.colortokens.PlacedToken
import com.dsbuilder.ds.themes.application.colortokens.StoredColorTokenFamily
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenNaming
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueKind
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueShape
import com.dsbuilder.ds.themes.domain.colortokens.FamilyValue
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

/** Цветовые операции над предметными редакциями без общей блокировки всех тем. */
class ExposedColorTokenRepository(
    private val referenceCleaners: List<TokenReferenceCleaner> = emptyList(),
) : ColorTokenRepository {
    override suspend fun lock(
        projectId: ProjectId,
        tenantId: UUID,
        editRevision: Int,
        allThemes: Boolean,
    ): ColorTokenLock {
        val tenant = currentTenantRows(projectId, tenantId = tenantId).singleOrNull()
            ?.takeIf { it[ThemeDesignSystemsTable.projectId] == projectId.value } ?: return ColorTokenLock.NotFound
        val owner = tenant[TenantsTable.designSystemId]
        lockDesignSystemMutation(owner)
        val tenants = if (allThemes) {
            currentTenantRows(
                projectId,
                owner,
            ).map { it[TenantsTable.id] }
        } else {
            listOf(tenantId)
        }
        // Совместимое поле DTO больше не участвует в конкурентной записи.
        return ColorTokenLock.Locked(owner, tenants, 0)
    }

    override suspend fun family(designSystemId: UUID, tokenId: UUID): ColorTokenLookup {
        val rows = currentThemeTokenRows(designSystemId)
        if (rows.none { it[ThemeTokensTable.id] == tokenId }) return ColorTokenLookup.Missing
        return familyOf(rows, tokenId)?.let(ColorTokenLookup::Found) ?: ColorTokenLookup.OutsideFamily
    }

    override fun familyInDraft(designSystemId: UUID, tokenId: UUID): StoredColorTokenFamily? =
        familyOf(currentThemeTokenRows(designSystemId), tokenId)

    override fun familiesInDraft(designSystemId: UUID, tokenIds: Collection<UUID>): Map<UUID, StoredColorTokenFamily> {
        if (tokenIds.isEmpty()) return emptyMap()
        val rows = currentThemeTokenRows(designSystemId)
        return tokenIds.distinct().mapNotNull { tokenId -> familyOf(rows, tokenId)?.let { tokenId to it } }.toMap()
    }

    override fun lockFamilyDefinitions(designSystemId: UUID, tokenIds: Collection<UUID>): Boolean =
        lockDraftSubjects(designSystemId, TOKEN_ENTITY_TYPE, tokenIds)

    override fun familyValuesInDraft(designSystemId: UUID, tokenIds: Collection<UUID>): List<FamilyValue> =
        if (tokenIds.isEmpty()) {
            emptyList()
        } else {
            currentThemeTokenValueRows(designSystemId, tokenIds = tokenIds.toSet()).mapNotNull { row ->
                row[ThemeTokenValuesTable.platform]?.let { FamilyValue(it, row[ThemeTokenValueRevisionsTable.value]) }
            }
        }

    override fun reviseFamilyType(tokenIds: Collection<UUID>, type: ThemeTokenType) {
        val owner = currentThemeTokenRows(tokenIds = tokenIds.toSet()).firstOrNull()
            ?.get(ThemeTokensTable.designSystemId) ?: return
        val draft = requireNotNull(themeDraft(owner))[ThemeVersionBoundariesTable.id]
        val revisions = entityEditRevisions(draft, TOKEN_ENTITY_TYPE, tokenIds.toSet())
        tokenIds.sorted().forEach { token ->
            // Тип производный: базой служит текущая техническая редакция под блокировкой, поэтому запись не
            // конфликтует с правками пользователя, а её редакция попадает в X-DS-Mutation-Metadata.
            reviseThemeToken(token, setOf("/type"), baseRevision = revisions[token] ?: 0) { it.copy(type = type) }
        }
    }

    override fun designSystemOf(tokenId: UUID): UUID? =
        currentThemeTokenRows(tokenIds = setOf(tokenId)).singleOrNull()?.get(ThemeTokensTable.designSystemId)

    override fun familyTypeCandidates(designSystemId: UUID, tenantId: UUID): List<StoredColorTokenFamily> {
        val rows = currentThemeTokenRows(designSystemId)
        val gradients = rows
            .filter { it[ThemeTokenRevisionsTable.type] == ThemeTokenType.GRADIENT }
            .map { it[ThemeTokensTable.id] }
        val withGradientValues = currentThemeTokenValueRows(designSystemId, tenantIds = setOf(tenantId))
            .filter { row ->
                val platform = row[ThemeTokenValuesTable.platform]
                val value = row[ThemeTokenValueRevisionsTable.value]
                platform != null && value != null && ColorValueShape.kind(platform, value) == ColorValueKind.GRADIENT
            }
            .map { it[ThemeTokenValuesTable.tokenId] }
        // Семейства строятся в памяти по одному чтению определений; члены уже найденного семейства пропускаются.
        val families = mutableListOf<StoredColorTokenFamily>()
        val members = mutableSetOf<UUID>()
        (gradients + withGradientValues).distinct().sorted().forEach { tokenId ->
            if (tokenId in members) return@forEach
            val family = familyOf(rows, tokenId) ?: return@forEach
            families += family
            members += family.members.values
        }
        return families
    }

    private fun familyOf(rows: List<ResultRow>, tokenId: UUID): StoredColorTokenFamily? {
        val token = rows.firstOrNull { it[ThemeTokensTable.id] == tokenId } ?: return null
        val family = token[ThemeTokenRevisionsTable.type]?.let {
            ColorTokenFamily.of(it, token[ThemeTokenRevisionsTable.name])
        } ?: return null
        // Члены — по правилу имени среди всех типов семейств: тип производный и может временно различаться.
        val members = rows.filter { row ->
            row[ThemeTokenRevisionsTable.type]?.let { family.memberOf(it, row[ThemeTokenRevisionsTable.name]) } == true
        }
        return StoredColorTokenFamily(
            family,
            members.associate { it[ThemeTokenRevisionsTable.name] to it[ThemeTokensTable.id] },
            members.associate { it[ThemeTokensTable.id] to requireNotNull(it[ThemeTokenRevisionsTable.type]) },
        )
    }

    override suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String> =
        if (names.isEmpty()) {
            emptySet()
        } else {
            currentThemeTokenRows(designSystemId)
                .map { it[ThemeTokenRevisionsTable.name] }.filter { it in names }.toSet()
        }

    override suspend fun tokenTypes(tokenIds: Collection<UUID>): Map<UUID, ThemeTokenType> =
        if (tokenIds.isEmpty()) {
            emptyMap()
        } else {
            currentThemeTokenRows(tokenIds = tokenIds.toSet())
                .mapNotNull { row ->
                    row[ThemeTokenRevisionsTable.type]?.let { row[ThemeTokensTable.id] to it }
                }.toMap()
        }

    override suspend fun insertDefinitions(
        designSystemId: UUID,
        family: ColorTokenFamily,
        names: List<String>,
        displayName: String?,
        description: String?,
        groupId: UUID?,
        position: Int,
    ): Map<String, UUID> = names.associateWith { name ->
        val entity = UUID.randomUUID()
        ThemeTokensTable.insert {
            it[id] = entity
            it[ThemeTokensTable.designSystemId] = designSystemId
            it[createdAt] = Instant.now()
        }
        val isDefault = name == family.defaultMember()
        writeThemeTokenRevision(
            entity,
            designSystemId,
            ThemeTokenPayload(
                name,
                family.type,
                displayName.takeIf { isDefault },
                description.takeIf { isDefault },
                true,
                groupId,
                position,
            ),
            setOf("/"),
        )
        entity
    }

    override suspend fun placedIn(designSystemId: UUID, groupIds: Collection<UUID>): List<PlacedToken> =
        if (groupIds.isEmpty()) {
            emptyList()
        } else {
            currentThemeTokenRows(designSystemId)
                .filter { it[ThemeTokenRevisionsTable.groupId] in groupIds }.map(::placed)
        }

    override suspend fun placedById(tokenIds: Collection<UUID>): List<PlacedToken> =
        if (tokenIds.isEmpty()) emptyList() else currentThemeTokenRows(tokenIds = tokenIds.toSet()).map(::placed)

    override suspend fun arrange(groupId: UUID?, slots: List<Collection<UUID>>) {
        slots.forEachIndexed { index, ids ->
            ids.sorted().forEach { token ->
                reviseThemeToken(
                    token,
                    setOf("/group_id", "/position"),
                ) { it.copy(groupId = groupId, position = index) }
            }
        }
    }

    override suspend fun rename(names: Map<UUID, String>) {
        names.toSortedMap().forEach { (token, name) ->
            reviseThemeToken(token, setOf("/name", "/display_name")) {
                it.copy(name = name, displayName = ColorTokenNaming.displayName(name))
            }
        }
    }

    private fun placed(row: ResultRow) = PlacedToken(
        row[ThemeTokensTable.id],
        row[ThemeTokenRevisionsTable.name],
        row[ThemeTokenRevisionsTable.type],
        row[ThemeTokenRevisionsTable.groupId],
        row[ThemeTokenRevisionsTable.position],
    )

    override suspend fun insertValues(tenantIds: Collection<UUID>, values: Map<UUID, List<ColorTokenValue>>) {
        tenantIds.sorted().forEach { tenant ->
            values.toSortedMap().forEach { (token, items) -> saveValues(tenant, token, items) }
        }
    }

    override suspend fun replaceValues(tenantId: UUID, values: Map<UUID, List<ColorTokenValue>>) {
        values.toSortedMap().forEach { (token, items) -> saveValues(tenantId, token, items) }
    }

    override suspend fun deleteDefinitions(tokenIds: Collection<UUID>, primaryTokenId: UUID?) {
        if (tokenIds.isEmpty()) return
        // Редакция удаляемой группы/определения не является базовой редакцией каждого зависимого значения.
        SubjectMutationPaths.withoutBaseComparison {
            currentThemeTokenRows(tokenIds = tokenIds.toSet()).groupBy { it[ThemeTokensTable.designSystemId] }
                .forEach { (owner, rows) ->
                    val ids = rows.mapTo(hashSetOf()) { row -> row[ThemeTokensTable.id] }
                    if (owner != null) referenceCleaners.forEach { it.clear(owner, ids) }
                }
            TenantPaletteTokenGroupsTable.selectAll().where { TenantPaletteTokenGroupsTable.tokenId inList tokenIds }
                .sortedBy { it[TenantPaletteTokenGroupsTable.id] }.forEach { row ->
                    PaletteAssignmentRevisions.replace(
                        row[TenantPaletteTokenGroupsTable.id],
                        row[TenantPaletteTokenGroupsTable.designSystemId],
                        setOf("/deleted"),
                        removed = true,
                    )
                }
            deleteThemeValues(tokenIds.toSet())
            tokenIds.sorted().forEach { token ->
                if (token != primaryTokenId) reviseThemeToken(token, setOf("/deleted")) { it.copy(deleted = true) }
            }
        }
        if (primaryTokenId != null) reviseThemeToken(primaryTokenId, setOf("/deleted")) { it.copy(deleted = true) }
    }

    override suspend fun bumpRevisions(tenantIds: Collection<UUID>): Map<UUID, Int> = tenantIds.associateWith { 0 }

    private fun saveValues(tenant: UUID, token: UUID, items: List<ColorTokenValue>) {
        val owner = requireNotNull(currentTenantRows(tenantId = tenant).singleOrNull())[TenantsTable.designSystemId]
        val existing = currentThemeTokenValueRows(owner, setOf(tenant), setOf(token))
        // Отсутствующая платформа не является командой её удаления или перезаписи.
        items.forEach { item ->
            val stable = ThemeTokenValuesTable.selectAll().where {
                (ThemeTokenValuesTable.tenantId eq tenant) and (ThemeTokenValuesTable.tokenId eq token) and
                    (ThemeTokenValuesTable.platform eq item.platform) and
                    (item.mode?.let { ThemeTokenValuesTable.mode eq it } ?: ThemeTokenValuesTable.mode.isNull())
            }.singleOrNull()
            val entity = stable?.get(ThemeTokenValuesTable.id) ?: UUID.randomUUID().also { id ->
                ThemeTokenValuesTable.insert {
                    it[ThemeTokenValuesTable.id] = id
                    it[designSystemId] = owner
                    it[tokenId] = token
                    it[tenantId] = tenant
                    it[platform] = item.platform
                    it[mode] = item.mode
                    it[createdAt] = Instant.now()
                }
            }
            val before = existing.firstOrNull { it[ThemeTokenValuesTable.id] == entity }
            val paths = changedValuePaths(before, item)
            if (paths.isNotEmpty()) {
                writeThemeValueRevision(
                    entity,
                    owner,
                    item.paletteId,
                    item.value,
                    item.overridden,
                    paths = paths,
                    baseRevision = item.baseRevision,
                )
            }
        }
    }

    /** Изменённые пути значения: `/palette_id` и `/value` вместе, как прежде, и `/overridden` отдельно. */
    private fun changedValuePaths(before: ResultRow?, item: ColorTokenValue): Set<String> = buildSet {
        val valueChanged = before == null || before[ThemeTokenValueRevisionsTable.paletteId] != item.paletteId ||
            before[ThemeTokenValueRevisionsTable.value] != item.value
        if (valueChanged) addAll(listOf("/palette_id", "/value"))
        if (before == null || before[ThemeTokenValueRevisionsTable.overridden] != item.overridden) add("/overridden")
    }

    private companion object {
        const val TOKEN_ENTITY_TYPE = "token"
    }
}
