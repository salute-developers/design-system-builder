package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.data.lockDraftSubjects
import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.palette.PaletteRampOrigin
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRebuilder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.LongColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.security.MessageDigest
import java.util.UUID

/** Рассчитанные ступени принадлежат перестроению; отличающиеся от расчёта ручные цвета — отдельным правкам. */
internal fun withPaletteRebuildJournal(handlers: List<DraftChangeHandler>): List<DraftChangeHandler> {
    val ramps = handlers.single { it.entityType == "palette-ramp" }
    val steps = handlers.single { it.entityType == "palette-step" }
    val projection = PaletteRebuildProjection(ramps, steps)
    return handlers.map { delegate ->
        when (delegate.entityType) {
            "palette-ramp" -> object : DraftChangeHandler by delegate {
                override fun canRemoveCreated(versionId: UUID, entityId: UUID): Boolean =
                    projection.canRemoveCreated(versionId, entityId)

                override fun describeEntity(
                    designSystemId: UUID,
                    sequenceNumber: Long,
                    previousSequenceNumber: Long,
                    entityId: UUID,
                ) = projection.ramp(designSystemId, sequenceNumber, previousSequenceNumber, entityId)

                override fun describe(
                    designSystemId: UUID,
                    sequenceNumber: Long,
                    previousSequenceNumber: Long,
                    limit: Int?,
                ) = projection.ramps(designSystemId, sequenceNumber, previousSequenceNumber, limit)

                override fun hasChanges(designSystemId: UUID, sequenceNumber: Long, previousSequenceNumber: Long) =
                    describe(designSystemId, sequenceNumber, previousSequenceNumber, null).isNotEmpty()

                override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean =
                    projection.revertRamp(versionId, entityId)
                        ?: delegate.revert(versionId, entityId, removeStableEntity)
            }
            "palette-step" -> object : DraftChangeHandler by delegate {
                override fun describeEntity(
                    designSystemId: UUID,
                    sequenceNumber: Long,
                    previousSequenceNumber: Long,
                    entityId: UUID,
                ) = projection.step(designSystemId, sequenceNumber, previousSequenceNumber, entityId)

                override fun describe(
                    designSystemId: UUID,
                    sequenceNumber: Long,
                    previousSequenceNumber: Long,
                    limit: Int?,
                ) = projection.steps(designSystemId, sequenceNumber, previousSequenceNumber, limit)

                override fun prepareRevert(designSystemId: UUID, entityId: UUID): Boolean {
                    val ramp = StablePaletteSteps.selectAll().where { StablePaletteSteps.id eq entityId }
                        .singleOrNull()?.get(StablePaletteSteps.rampId) ?: return false
                    return lockDraftSubject(designSystemId, "palette-ramp", ramp)
                }

                override fun hasChanges(designSystemId: UUID, sequenceNumber: Long, previousSequenceNumber: Long) =
                    describe(designSystemId, sequenceNumber, previousSequenceNumber, null).isNotEmpty()

                override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean =
                    projection.revertStep(versionId, entityId)
                        ?: delegate.revert(versionId, entityId, removeStableEntity)
            }
            else -> delegate
        }
    }
}

private class PaletteRebuildProjection(
    private val rampHandler: DraftChangeHandler,
    private val stepHandler: DraftChangeHandler,
) {
    fun canRemoveCreated(version: UUID, entity: UUID): Boolean {
        val boundary = boundary(version) ?: return false
        val plan = plans(
            listOfNotNull(rampHandler.describeEntity(boundary.owner, boundary.sequence, boundary.previous, entity)),
            boundary.sequence,
            boundary.previous,
        )[entity]
        return if (plan == null) {
            children(listOf(entity), boundary.sequence, boundary.previous)[entity].orEmpty().none { it.after != null }
        } else {
            !plan.createdRamp || plan.steps.none(plan::isManual)
        }
    }

    fun ramp(owner: UUID, sequence: Long, previous: Long, entity: UUID): DraftSubjectChange? {
        val change = rampHandler.describeEntity(owner, sequence, previous, entity) ?: return null
        return plans(listOf(change), sequence, previous)[entity]?.change() ?: change.takeUnless(::implicitTemplate)
    }

    fun step(owner: UUID, sequence: Long, previous: Long, entity: UUID): DraftSubjectChange? {
        val rampId = StablePaletteSteps.selectAll().where { StablePaletteSteps.id eq entity }
            .singleOrNull()?.get(StablePaletteSteps.rampId) ?: return null
        val parent = rampHandler.describeEntity(owner, sequence, previous, rampId)
        val plan = plans(listOfNotNull(parent), sequence, previous)[rampId]
        if (plan != null) return plan.steps.singleOrNull { it.id == entity }?.let(plan::manualChange)
        return stepHandler.describeEntity(owner, sequence, previous, entity)
    }

    fun ramps(owner: UUID, sequence: Long, previous: Long, limit: Int?): List<DraftSubjectChange> {
        val changes = rampHandler.describe(owner, sequence, previous, limit)
        val plans = plans(changes, sequence, previous)
        return changes.mapNotNull { change ->
            plans[change.entityId]?.change() ?: change.takeUnless(::implicitTemplate)
        }
    }

    fun steps(owner: UUID, sequence: Long, previous: Long, limit: Int?): List<DraftSubjectChange> {
        val changes = stepHandler.describe(owner, sequence, previous, limit)
        val plans = plans(rampHandler.describe(owner, sequence, previous), sequence, previous)
        val covered = plans.values.flatMap { it.steps }.mapTo(hashSetOf()) { it.id }
        val manual = plans.values.flatMap { plan -> plan.steps.mapNotNull { plan.manualChange(it) } }
        return (changes.filterNot { it.entityId in covered } + manual).let { result ->
            if (limit == null) result else result.take(limit)
        }
    }

    fun revertRamp(version: UUID, entity: UUID): Boolean? {
        val boundary = boundary(version) ?: return null
        val plan = plans(
            listOfNotNull(rampHandler.describeEntity(boundary.owner, boundary.sequence, boundary.previous, entity)),
            boundary.sequence,
            boundary.previous,
        )[entity] ?: return null
        return if (lockDraftSubjects(boundary.owner, "palette-step", plan.steps.map { it.id })) {
            restoreGeneratedSteps(version, plan.steps.filterNot(plan::isManual))
            restoreRamp(version, entity, boundary.owner, plan)
        } else {
            false
        }
    }

    private fun restoreRamp(version: UUID, entity: UUID, owner: UUID, plan: RebuildPlan): Boolean = when {
        plan.createdRamp -> {
            // Ручные ступени проверены до удаления; каскадный FK не служит защитой от их потери.
            rampHandler.revert(version, entity, removeStableEntity = true)
        }
        plan.original.previousValue == null -> {
            // Отсутствующая устойчивая запись означает исходную растяжку шаблона, а не отсутствие цветов.
            // Сохраняем родителя ручных правок, но возвращаем его исходные параметры.
            PaletteRampRevisions.replace(entity, owner, setOf("/")) {
                it[PaletteRampRevisions.sourceType] = ThemePaletteType.fromWire(plan.before.text("source_type"))
                it[PaletteRampRevisions.sourceShade] = plan.before.text("source_shade")
                it[PaletteRampRevisions.added] = false
                it[PaletteRampRevisions.origin] = PaletteRampOrigin.TEMPLATE
                it[PaletteRampRevisions.anchorStep] = null
                it[PaletteRampRevisions.anchorValue] = null
            }
            true
        }
        else -> rampHandler.revert(version, entity, removeStableEntity = false)
    }

    fun revertStep(version: UUID, entity: UUID): Boolean? {
        val boundary = boundary(version) ?: return null
        val plan = stepPlan(boundary, entity) ?: return null
        val step = plan.steps.single { it.id == entity }
        val generated = plan.generated[step.number]
        return if (plan.isManual(step) && generated != null) {
            PaletteStepRevisions.replace(entity, boundary.owner, setOf("/value")) {
                it[PaletteStepRevisions.value] = generated
            }
            true
        } else {
            false
        }
    }

    private fun stepPlan(boundary: JournalBoundary, entity: UUID): RebuildPlan? {
        val ramp = StablePaletteSteps.selectAll().where { StablePaletteSteps.id eq entity }
            .singleOrNull()?.get(StablePaletteSteps.rampId) ?: return null
        val plans = plans(
            listOfNotNull(rampHandler.describeEntity(boundary.owner, boundary.sequence, boundary.previous, ramp)),
            boundary.sequence,
            boundary.previous,
        )
        return plans.values.firstOrNull { ramp -> ramp.steps.any { it.id == entity } }
    }

    private fun plans(changes: List<DraftSubjectChange>, sequence: Long, previous: Long): Map<UUID, RebuildPlan> {
        val rebuilt = changes.filter { it.currentValue?.text("origin") == "rebuild" }
        if (rebuilt.isEmpty()) return emptyMap()
        val children = children(rebuilt.map { it.entityId }, sequence, previous)
        val tenants = rebuilt.map { UUID.fromString(requireNotNull(it.currentValue).text("tenant_id")) }.distinct()
        val template = TenantPaletteTemplateTable.selectAll()
            .where { TenantPaletteTemplateTable.tenantId inList tenants }
            .groupBy {
                Triple(
                    it[TenantPaletteTemplateTable.tenantId],
                    it[TenantPaletteTemplateTable.type].wireValue,
                    it[TenantPaletteTemplateTable.shade],
                )
            }
            .mapValues { (_, rows) ->
                rows.associate { it[TenantPaletteTemplateTable.step] to it[TenantPaletteTemplateTable.value] }
            }
        return rebuilt.mapNotNull { change ->
            val after = requireNotNull(change.currentValue)
            val before = change.previousValue ?: defaultRamp(after)
            val tenant = UUID.fromString(after.text("tenant_id"))
            fun source(value: JsonObject) =
                template[Triple(tenant, value.text("source_type"), value.text("source_shade"))].orEmpty()
            val anchorStep = after["anchor_step"]?.jsonPrimitive?.intOrNull ?: return@mapNotNull null
            val generated = PaletteRampRebuilder.rebuild(source(after), anchorStep, after.text("anchor_value"))
                ?: return@mapNotNull null
            val steps = children[change.entityId].orEmpty()
            val baseline = source(before) + steps.mapNotNull { step -> step.before?.let { step.number to it } }
            change.entityId to RebuildPlan(change, before, after, steps, generated, baseline)
        }.toMap()
    }
}

private fun restoreGeneratedSteps(version: UUID, steps: List<JournalPaletteStep>) {
    steps.chunked(500).forEach { batch ->
        val ids = batch.map { it.id }
        val placeholders = ids.joinToString(",") { "?" }
        val args = listOf(UUIDColumnType() to version) + ids.map { UUIDColumnType() to it }
        val transaction = TransactionManager.current()
        transaction.exec(
            "DELETE FROM tenant_palette_step_revisions WHERE design_system_version_id = ? " +
                "AND step_id IN ($placeholders)",
            args,
        )
        transaction.exec(
            "DELETE FROM entity_edit_paths WHERE design_system_version_id = ? " +
                "AND entity_type = 'palette-step' AND entity_id IN ($placeholders)",
            args,
        )
        // Удаляется только созданная черновая строка без каких-либо исторических редакций.
        val created = batch.filter { it.before == null }.map { it.id }
        if (created.isNotEmpty()) {
            transaction.exec(
                "DELETE FROM tenant_palette_steps s WHERE s.id IN (${created.joinToString(",") { "?" }}) " +
                    "AND NOT EXISTS (SELECT 1 FROM tenant_palette_step_revisions r WHERE r.step_id = s.id)",
                created.map { UUIDColumnType() to it },
            )
        }
    }
}

private data class JournalPaletteStep(val id: UUID, val number: Int, val before: String?, val after: String?)

private data class RebuildPlan(
    val original: DraftSubjectChange,
    val before: JsonObject,
    val after: JsonObject,
    val steps: List<JournalPaletteStep>,
    val generated: Map<Int, String>,
    val baseline: Map<Int, String>,
) {
    val createdRamp: Boolean
        get() = original.previousValue == null && after["added"] == JsonPrimitive(true)

    fun isManual(step: JournalPaletteStep) = step.after != null && step.after != generated[step.number]

    fun change(): DraftSubjectChange {
        val beforeValue = JsonObject(before + ("steps" to colors(baseline)))
        val afterValue = JsonObject(after + ("steps" to colors(generated)))
        return original.copy(
            previousValue = beforeValue.takeUnless { createdRamp },
            currentValue = afterValue,
            changedPaths = original.changedPaths + "/steps",
            comparisonRevision = comparisonRevision(original, steps),
        )
    }

    fun manualChange(step: JournalPaletteStep): DraftSubjectChange? {
        if (!isManual(step)) return null
        val location = mapOf(
            "tenant_id" to after.getValue("tenant_id"),
            "group_id" to after.getValue("group_id"),
            "slot_type" to after.getValue("slot_type"),
            "slot_shade" to after.getValue("slot_shade"),
            "group_label" to (after["group_label"] ?: JsonNull),
            "ramp_id" to JsonPrimitive(original.entityId.toString()),
            "step" to JsonPrimitive(step.number),
        )
        return DraftSubjectChange(
            step.id,
            JsonObject(location + ("value" to JsonPrimitive(generated[step.number]))),
            JsonObject(location + ("value" to JsonPrimitive(step.after))),
            setOf("/value"),
            comparisonRevision(original, listOf(step)),
        )
    }
}

private fun colors(values: Map<Int, String>) = JsonObject(
    values.toSortedMap().mapKeys { it.key.toString() }.mapValues { JsonPrimitive(it.value) },
)

// 48 бит: непрозрачное сравнение состава изменения без потери точности в JavaScript Number.
private fun comparisonRevision(change: DraftSubjectChange, steps: List<JournalPaletteStep>): Long {
    val value = listOf(change.previousValue, change.currentValue, steps.sortedBy { it.id }).joinToString("|")
    return MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).take(6)
        .fold(0L) { result, byte -> (result shl 8) or (byte.toLong() and 255) }
}

private fun implicitTemplate(change: DraftSubjectChange): Boolean = change.previousValue == null &&
    change.currentValue?.let { it == defaultRamp(it) } == true

private fun defaultRamp(value: JsonObject) = JsonObject(
    value + mapOf(
        "source_type" to value.getValue("slot_type"), "source_shade" to value.getValue("slot_shade"),
        "added" to JsonPrimitive(false), "origin" to JsonPrimitive("template"),
        "anchor_step" to JsonNull, "anchor_value" to JsonNull,
    ),
)

private fun JsonObject.text(key: String): String = get(key)?.jsonPrimitive?.contentOrNull.orEmpty()

private data class JournalBoundary(val owner: UUID, val sequence: Long, val previous: Long)

private fun boundary(version: UUID): JournalBoundary? = TransactionManager.current().exec(
    """
    SELECT target.design_system_id, target.sequence_number, COALESCE(
      max(prior.sequence_number) FILTER (WHERE prior.status = 'published'),
      max(prior.sequence_number) FILTER (WHERE prior.status = 'baseline'), 0) AS previous_sequence
    FROM design_system_versions target
    LEFT JOIN design_system_versions prior ON prior.design_system_id = target.design_system_id
      AND prior.sequence_number < target.sequence_number
    WHERE target.id = ? AND target.status = 'draft'
    GROUP BY target.design_system_id, target.sequence_number
    """.trimIndent(),
    listOf(UUIDColumnType() to version),
) { rows ->
    if (rows.next()) JournalBoundary(rows.getObject(1, UUID::class.java), rows.getLong(2), rows.getLong(3)) else null
}

private fun children(ramps: List<UUID>, sequence: Long, previous: Long): Map<UUID, List<JournalPaletteStep>> =
    ramps.chunked(500).flatMap { ids ->
        val sql = """
            SELECT step.id, step.ramp_id, step.step,
              CASE WHEN NOT before.deleted THEN before.value END AS before_value,
              CASE WHEN NOT after.deleted THEN after.value END AS after_value
            FROM tenant_palette_steps step
            LEFT JOIN LATERAL (SELECT r.value, r.deleted FROM tenant_palette_step_revisions r
              WHERE r.step_id = step.id AND r.version_sequence_number <= ?
              ORDER BY r.version_sequence_number DESC LIMIT 1) before ON true
            LEFT JOIN LATERAL (SELECT r.value, r.deleted FROM tenant_palette_step_revisions r
              WHERE r.step_id = step.id AND r.version_sequence_number <= ?
              ORDER BY r.version_sequence_number DESC LIMIT 1) after ON true
            WHERE step.ramp_id IN (${ids.joinToString(",") { "?" }}) ORDER BY step.id
        """.trimIndent()
        TransactionManager.current().exec(
            sql,
            listOf(LongColumnType() to previous, LongColumnType() to sequence) + ids.map { UUIDColumnType() to it },
        ) { rows ->
            buildList {
                while (rows.next()) {
                    add(
                        rows.getObject("ramp_id", UUID::class.java) to JournalPaletteStep(
                            rows.getObject("id", UUID::class.java), rows.getInt("step"),
                            rows.getString("before_value"), rows.getString("after_value"),
                        ),
                    )
                }
            }
        }.orEmpty()
    }.groupBy({ it.first }, { it.second })
