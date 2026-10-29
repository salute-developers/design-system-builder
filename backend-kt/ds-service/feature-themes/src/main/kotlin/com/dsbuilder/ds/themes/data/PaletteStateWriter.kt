package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.themes.domain.palette.StoredPaletteGroup
import com.dsbuilder.ds.themes.domain.palette.StoredPaletteRamp
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.UUID

/** Записывает разницу предметных состояний, а не заменяет всю палитру темы. */
internal class PaletteStateWriter(private val owner: UUID, private val tenant: UUID) {
    fun save(before: TenantPaletteState, after: TenantPaletteState) {
        val oldGroups = before.groups.associateBy { it.id }
        val newGroups = after.groups.associateBy { it.id }
        newGroups.toSortedMap().forEach { (id, group) ->
            val previous = oldGroups[id]
            val position = after.groups.indexOf(group)
            val oldPosition = before.groups.indexOfFirst { it.id == id }
            if (previous == null) {
                insertPaletteGroup(owner, tenant, group, position)
            } else if (previous != group || position != oldPosition) {
                val entity = UUID.fromString(id)
                lockDraftSubject(owner, "palette-group", entity)
                val current = TenantPaletteGroupsTable.selectAll()
                    .where { TenantPaletteGroupsTable.id eq entity }.singleOrNull()
                    ?: error("Palette group was removed concurrently")
                val paths = buildSet {
                    if (previous.label != group.label) add("/label")
                    if (oldPosition != position) add("/position")
                }
                PaletteGroupRevisions.replace(entity, owner, paths) {
                    it[PaletteGroupRevisions.label] = changed(
                        previous.label, group.label, current[TenantPaletteGroupsTable.label],
                    )
                    it[PaletteGroupRevisions.position] = changed(
                        oldPosition, position, current[TenantPaletteGroupsTable.position],
                    )
                }
            }
        }
        if ((oldGroups.keys - newGroups.keys).isEmpty()) {
            saveContents(before, after)
        } else {
            SubjectMutationPaths.withoutBaseComparison { saveContents(before, after) }
        }
        (oldGroups.keys - newGroups.keys).sorted().forEach { id ->
            PaletteGroupRevisions.replace(UUID.fromString(id), owner, setOf("/deleted"), removed = true)
        }
    }

    private fun saveContents(before: TenantPaletteState, after: TenantPaletteState) {
        val oldRamps = before.ramps.associateBy(::rampKey)
        val newRamps = after.ramps.associateBy(::rampKey)
        (oldRamps.keys + newRamps.keys).sorted().forEach { key ->
            val previous = oldRamps[key]
            val next = newRamps[key]
            if (previous != next) saveRamp(previous, next)
        }
        (before.tokenGroups.keys + after.tokenGroups.keys).sorted().forEach { token ->
            if (before.tokenGroups[token] != after.tokenGroups[token]) saveAssignment(token, after.tokenGroups[token])
        }
    }

    private fun saveRamp(before: StoredPaletteRamp?, after: StoredPaletteRamp?) {
        val ramp = requireNotNull(after ?: before)
        val entity = findOrCreateRamp(ramp)
        lockDraftSubject(owner, "palette-ramp", entity)
        val rampChanged = after == null || before?.copy(steps = emptyMap()) != after.copy(steps = emptyMap())
        if (after != null && rampChanged) saveRampPayload(entity, before, after)
        if (rampChanged) {
            SubjectMutationPaths.withoutBaseComparison { saveRampSteps(entity, before, after) }
        } else {
            saveRampSteps(entity, before, after)
        }
        if (after == null) {
            // Сначала дочерние редакции: уплотнение может убрать созданную в этом черновике растяжку.
            PaletteRampRevisions.replace(entity, owner, setOf("/deleted"), removed = true)
        }
    }

    private fun findOrCreateRamp(ramp: StoredPaletteRamp): UUID {
        val group = UUID.fromString(ramp.groupId)
        lockNatural("palette-ramp-slot", rampKey(ramp))
        val stable = StablePaletteRamps.selectAll().where {
            (StablePaletteRamps.designSystemId eq owner) and (StablePaletteRamps.groupId eq group) and
                (StablePaletteRamps.slotType eq ramp.slot.type) and (StablePaletteRamps.slotShade eq ramp.slot.shade)
        }.singleOrNull()
        return stable?.get(StablePaletteRamps.id) ?: UUID.randomUUID().also { id ->
            StablePaletteRamps.insert {
                it[StablePaletteRamps.id] = id
                it[designSystemId] = owner
                it[groupId] = group
                it[slotType] = ramp.slot.type
                it[slotShade] = ramp.slot.shade
                it[createdAt] = Instant.now()
            }
        }
    }

    private fun saveRampPayload(entity: UUID, before: StoredPaletteRamp?, after: StoredPaletteRamp) {
        val current = TenantPaletteRampsTable.selectAll().where { TenantPaletteRampsTable.id eq entity }.singleOrNull()
        val paths = if (before == null) {
            setOf("/")
        } else {
            buildSet {
                if (before.source.type != after.source.type) add("/source_type")
                if (before.source.shade != after.source.shade) add("/source_shade")
                if (before.added != after.added) add("/added")
                if (before.origin != after.origin) add("/origin")
                if (before.anchor?.step != after.anchor?.step) add("/anchor_step")
                if (before.anchor?.value != after.anchor?.value) add("/anchor_value")
            }
        }
        PaletteRampRevisions.replace(entity, owner, paths) {
            it[PaletteRampRevisions.sourceType] = changed(
                before?.source?.type, after.source.type, current?.get(TenantPaletteRampsTable.sourceType),
            )
            it[PaletteRampRevisions.sourceShade] = changed(
                before?.source?.shade, after.source.shade, current?.get(TenantPaletteRampsTable.sourceShade),
            )
            it[PaletteRampRevisions.added] = changed(
                before?.added, after.added, current?.get(TenantPaletteRampsTable.added),
            )
            it[PaletteRampRevisions.origin] = changed(
                before?.origin, after.origin, current?.get(TenantPaletteRampsTable.origin),
            )
            it[PaletteRampRevisions.anchorStep] = changed(
                before?.anchor?.step, after.anchor?.step, current?.get(TenantPaletteRampsTable.anchorStep),
            )
            it[PaletteRampRevisions.anchorValue] = changed(
                before?.anchor?.value, after.anchor?.value, current?.get(TenantPaletteRampsTable.anchorValue),
            )
        }
    }

    private fun saveRampSteps(entity: UUID, before: StoredPaletteRamp?, after: StoredPaletteRamp?) {
        val previousSteps = before?.steps.orEmpty()
        val nextSteps = after?.steps.orEmpty()
        (previousSteps.keys + nextSteps.keys).sorted().forEach { step ->
            if (previousSteps[step] != nextSteps[step]) saveStep(entity, step, nextSteps[step])
        }
    }

    private fun saveStep(ramp: UUID, step: Int, value: String?) {
        lockNatural("palette-step-slot", "$ramp:$step")
        val stable = StablePaletteSteps.selectAll().where {
            (StablePaletteSteps.rampId eq ramp) and (StablePaletteSteps.step eq step) and
                (StablePaletteSteps.designSystemId eq owner)
        }.singleOrNull()
        val entity = stable?.get(StablePaletteSteps.id) ?: UUID.randomUUID().also { id ->
            StablePaletteSteps.insert {
                it[StablePaletteSteps.id] = id
                it[designSystemId] = owner
                it[rampId] = ramp
                it[StablePaletteSteps.step] = step
            }
        }
        PaletteStepRevisions.replace(entity, owner, setOf("/value"), removed = value == null) {
            it[PaletteStepRevisions.value] = value
        }
    }

    private fun saveAssignment(token: String, group: String?) {
        val tokenId = UUID.fromString(token)
        lockNatural("palette-assignment-slot", "$tenant:$tokenId")
        val stable = StablePaletteAssignments.selectAll().where {
            (StablePaletteAssignments.tenantId eq tenant) and (StablePaletteAssignments.tokenId eq tokenId)
        }.singleOrNull()
        val entity = stable?.get(StablePaletteAssignments.id) ?: UUID.randomUUID().also { id ->
            StablePaletteAssignments.insert {
                it[StablePaletteAssignments.id] = id
                it[designSystemId] = owner
                it[tenantId] = tenant
                it[StablePaletteAssignments.tokenId] = tokenId
            }
        }
        PaletteAssignmentRevisions.replace(entity, owner, setOf("/group_id"), removed = group == null) {
            it[PaletteAssignmentRevisions.groupId] = group?.let(UUID::fromString)
        }
    }

    private fun lockNatural(kind: String, key: String) =
        lockDraftSubject(owner, kind, UUID.nameUUIDFromBytes("$owner:$key".toByteArray(StandardCharsets.UTF_8)))

    private fun rampKey(ramp: StoredPaletteRamp) = "${ramp.groupId}:${ramp.slot.type}:${ramp.slot.shade}"
}

internal fun insertPaletteGroup(owner: UUID, tenant: UUID, group: StoredPaletteGroup, position: Int) {
    val entity = UUID.fromString(group.id)
    lockDraftSubject(owner, "palette-group", entity)
    StablePaletteGroups.insert {
        it[id] = entity
        it[designSystemId] = owner
        it[tenantId] = tenant
        it[kind] = group.kind
        it[systemKey] = group.systemKey?.wireValue
        it[createdAt] = Instant.now()
    }
    PaletteGroupRevisions.replace(entity, owner, setOf("/")) {
        it[PaletteGroupRevisions.label] = group.label
        it[PaletteGroupRevisions.position] = position
    }
}

private fun <T> changed(before: T?, after: T, current: T?): T =
    if (before == after && current != null) current else after
