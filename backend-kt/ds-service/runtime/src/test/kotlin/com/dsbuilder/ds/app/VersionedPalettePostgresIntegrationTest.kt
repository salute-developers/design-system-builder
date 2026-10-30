package com.dsbuilder.ds.app

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.components.application.PropertyValueRepository
import com.dsbuilder.ds.components.application.StyleCombinationRepository
import com.dsbuilder.ds.components.data.ComponentTokenRevertDependencyValidator
import com.dsbuilder.ds.components.data.ExposedPropertyValueRepository
import com.dsbuilder.ds.components.data.ExposedStyleCombinationRepository
import com.dsbuilder.ds.components.di.componentsModule
import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentMutationRequest
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersion
import com.dsbuilder.ds.designsystems.application.PublishDesignSystemResult
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemVersionRepository
import com.dsbuilder.ds.designsystems.data.ExposedDraftChangeRepository
import com.dsbuilder.ds.designsystems.data.designSystemDraftChangeHandler
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChangeRevertResult
import com.dsbuilder.ds.themes.application.CreateTenant
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenValue
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.data.ExposedColorTokenRepository
import com.dsbuilder.ds.themes.data.ExposedTenantPaletteRepository
import com.dsbuilder.ds.themes.data.ExposedTenantRepository
import com.dsbuilder.ds.themes.data.PaletteRevertDependencyValidator
import com.dsbuilder.ds.themes.data.themeDraftChangeHandlers
import com.dsbuilder.ds.themes.data.themeDraftChangePolicy
import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.palette.PaletteAnchor
import com.dsbuilder.ds.themes.domain.palette.PaletteGroupKind
import com.dsbuilder.ds.themes.domain.palette.PaletteOperationResult
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.PaletteRampOrigin
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import com.dsbuilder.ds.themes.domain.palette.StoredPaletteGroup
import com.dsbuilder.ds.themes.domain.palette.StoredPaletteRamp
import com.dsbuilder.ds.themes.domain.palette.SystemPaletteGroup
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteResolver
import com.dsbuilder.ds.themes.domain.palette.TokenReferenceRewrite
import com.dsbuilder.ds.tokens.application.CreateToken
import com.dsbuilder.ds.tokens.data.ExposedTokenRepository
import com.dsbuilder.ds.tokens.data.tokenDraftChangeHandlers
import com.dsbuilder.ds.tokens.domain.TokenType
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.dsl.koinApplication
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class VersionedPalettePostgresIntegrationTest {
    @Test
    fun `undo removes explicitly added and rebuilt ramp`() = runBlocking {
        verifyCreatedRampUndo(manual = false)
    }

    @Test
    fun `undo of created ramp preserves independent manual step`() = runBlocking {
        verifyCreatedRampUndo(manual = true)
    }

    @Test
    fun `undo of created template ramp preserves independent manual step`() = runBlocking {
        verifyCreatedRampUndo(manual = true, rebuild = false)
    }

    private suspend fun verifyCreatedRampUndo(manual: Boolean, rebuild: Boolean = true) {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            fixture.publish()
            val group = fixture.snapshot().state.groups.single { it.systemKey == SystemPaletteGroup.DATA }.id
            fixture.mutate {
                val before = assertNotNull(fixture.palette.snapshot(PROJECT, fixture.tenant))
                val built = ThemePaletteBuilder.build(
                    fixture.tenant.toString(),
                    true,
                    before.state,
                    before.tokens,
                    before.values,
                )
                val added = assertIs<PaletteOperationResult.Applied<*>>(
                    PaletteOperations.addRamp(before.state, group, fixture.slot, built),
                )
                fixture.palette.save(fixture.tenant, before.state, added.state)
            }
            if (rebuild) fixture.rebuild("#3355AA", SystemPaletteGroup.DATA)
            if (manual) fixture.editStep(500, "#ABCDEF", SystemPaletteGroup.DATA)
            val beforeUndo = fixture.snapshot()
            val change = assertNotNull(
                fixture.read {
                    fixture.journal.list(PROJECT, false, fixture.system, null)
                },
            ).single { it.entityType == "palette-ramp" }
            assertEquals(null, change.previousValue)
            if (manual) {
                val result = fixture.mutate {
                    fixture.journal.revert(
                        PROJECT,
                        false,
                        fixture.system,
                        change.changeId,
                        change.editRevision,
                        emptySet(),
                    )
                }
                assertEquals(DraftChangeRevertResult.DependencyConflict, result)
                assertEquals(beforeUndo.state, fixture.snapshot().state)
                return
            }
            assertEquals(
                DraftChangeRevertResult.Reverted,
                fixture.mutate {
                    fixture.journal.revert(
                        PROJECT,
                        false,
                        fixture.system,
                        change.changeId,
                        change.editRevision,
                        emptySet(),
                    )
                },
            )
            assertTrue(fixture.snapshot().state.ramps.none { it.groupId == group && it.slot == fixture.slot })
            assertEquals(emptyList(), fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
        }
    }

    @Test
    fun `undo resolves only its tracked entity without describing the whole journal`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            val initial = fixture.snapshot()
            fixture.publish()
            fixture.write(fixture.snapshot(), 500, "#ABCDEF")
            fixture.write(fixture.snapshot(), 600, "#112233")
            val change = assertNotNull(
                fixture.read {
                    fixture.journal.list(PROJECT, false, fixture.system, null)
                },
            ).single { it.currentValue?.get("step") == JsonPrimitive(500) }
            val handlers = (
                listOf(designSystemDraftChangeHandler()) + themeDraftChangeHandlers() +
                    tokenDraftChangeHandlers()
                ).map { delegate ->
                object : DraftChangeHandler by delegate {
                    override fun describe(
                        designSystemId: UUID,
                        sequenceNumber: Long,
                        previousSequenceNumber: Long,
                        limit: Int?,
                    ): List<com.dsbuilder.ds.core.application.DraftSubjectChange> =
                        error("Undo must not enumerate unrelated journal entries")
                }
            }
            val journal = ExposedDraftChangeRepository(handlers, listOf(themeDraftChangePolicy()))
            assertEquals(
                DraftChangeRevertResult.Reverted,
                fixture.mutate {
                    journal.revert(PROJECT, false, fixture.system, change.changeId, change.editRevision, emptySet())
                },
            )
            assertEquals(fixture.color(initial, 500), fixture.color(fixture.snapshot(), 500))
            assertEquals("#112233", fixture.color(fixture.snapshot(), 600))
        }
    }

    @Test
    fun `rebuild journals once and its undo restores all generated steps`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            val initial = fixture.snapshot()
            val published = fixture.publish()
            fixture.rebuild("#DDAA33")
            fixture.rebuild("#3355AA")
            val changes = assertNotNull(fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(
                com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount(changes, emptyMap()),
                fixture.read { fixture.journal.summary(PROJECT, false, fixture.system, null) },
            )
            val rebuilt = changes.single()
            assertEquals("palette-ramp", rebuilt.entityType)
            assertNotNull(rebuilt.previousValue?.get("steps"))
            assertNotNull(rebuilt.currentValue?.get("steps"))
            val reverted = fixture.mutate {
                fixture.journal.revert(
                    PROJECT,
                    false,
                    fixture.system,
                    rebuilt.changeId,
                    rebuilt.editRevision,
                    emptySet(),
                )
            }
            assertEquals(DraftChangeRevertResult.Reverted, reverted)
            for (step in listOf(500, 600)) {
                assertEquals(fixture.color(initial, step), fixture.color(fixture.snapshot(), step))
                assertEquals(fixture.color(initial, step), fixture.color(fixture.snapshot(published), step))
            }
            assertEquals(emptyList(), fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
        }
    }

    @Test
    fun `manual step stays independent from rebuild and aggregate rejects stale undo`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres, materializeRamp = false)
            fixture.initialize()
            val initial = fixture.snapshot()
            fixture.publish()
            fixture.rebuild("#3355AA")
            val oldRebuild = assertNotNull(
                fixture.read {
                    fixture.journal.list(PROJECT, false, fixture.system, null)
                },
            ).single()
            fixture.write(fixture.snapshot(), 600, "#ABCDEF")
            val stale = fixture.mutate {
                fixture.journal.revert(
                    PROJECT,
                    false,
                    fixture.system,
                    oldRebuild.changeId,
                    oldRebuild.editRevision,
                    emptySet(),
                )
            }
            assertIs<DraftChangeRevertResult.Stale>(stale)
            val changes = assertNotNull(fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(
                com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount(changes, emptyMap()),
                fixture.read { fixture.journal.summary(PROJECT, false, fixture.system, null) },
            )
            assertEquals(setOf("palette-ramp", "palette-step"), changes.map { it.entityType }.toSet())
            val rebuilt = changes.single { it.entityType == "palette-ramp" }
            val reverted = fixture.mutate {
                fixture.journal.revert(
                    PROJECT,
                    false,
                    fixture.system,
                    rebuilt.changeId,
                    rebuilt.editRevision,
                    emptySet(),
                )
            }
            assertEquals(DraftChangeRevertResult.Reverted, reverted)
            val after = fixture.snapshot()
            assertEquals(fixture.color(initial, 500), fixture.color(after, 500))
            assertEquals("#ABCDEF", fixture.color(after, 600))
            val manual = assertNotNull(
                fixture.read {
                    fixture.journal.list(PROJECT, false, fixture.system, null)
                },
            ).single()
            assertEquals("palette-step", manual.entityType)
            assertEquals(
                DraftChangeRevertResult.Reverted,
                fixture.mutate {
                    fixture.journal.revert(
                        PROJECT,
                        false,
                        fixture.system,
                        manual.changeId,
                        manual.editRevision,
                        emptySet(),
                    )
                },
            )
            assertEquals(fixture.color(initial, 600), fixture.color(fixture.snapshot(), 600))
        }
    }

    @Test
    fun `manual anchor undo preserves rebuild`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            val initial = fixture.snapshot()
            fixture.publish()
            fixture.rebuild("#3355AA")
            val rebuilt = fixture.snapshot()
            fixture.editStep(500, "#ABCDEF")
            val changes = assertNotNull(fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(
                com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount(changes, emptyMap()),
                fixture.read { fixture.journal.summary(PROJECT, false, fixture.system, null) },
            )
            assertEquals(2, changes.size)
            val manual = changes.single { it.entityType == "palette-step" }
            assertEquals(JsonPrimitive(fixture.color(rebuilt, 500)), manual.previousValue?.get("value"))
            assertEquals(
                DraftChangeRevertResult.Reverted,
                fixture.mutate {
                    fixture.journal.revert(
                        PROJECT,
                        false,
                        fixture.system,
                        manual.changeId,
                        manual.editRevision,
                        emptySet(),
                    )
                },
            )
            assertEquals(fixture.color(rebuilt, 500), fixture.color(fixture.snapshot(), 500))
            val ramp = assertNotNull(
                fixture.read {
                    fixture.journal.list(PROJECT, false, fixture.system, null)
                },
            ).single()
            assertEquals("palette-ramp", ramp.entityType)
            assertEquals(
                DraftChangeRevertResult.Reverted,
                fixture.mutate {
                    fixture.journal.revert(PROJECT, false, fixture.system, ramp.changeId, ramp.editRevision, emptySet())
                },
            )
            assertEquals(fixture.color(initial, 500), fixture.color(fixture.snapshot(), 500))
            assertEquals(fixture.color(initial, 600), fixture.color(fixture.snapshot(), 600))
        }
    }

    @Test
    fun `ramp base revision is not compared with dependent step revisions`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            fixture.publish()
            fixture.write(fixture.snapshot(), 500, "#ABCDEF")
            val result = assertIs<DsResult.Success<Unit>>(
                fixture.transactions.required(fixture.context) {
                    val before = assertNotNull(fixture.palette.snapshot(PROJECT, fixture.tenant))
                    val after = before.state.copy(
                        ramps = before.state.ramps.map {
                            it.copy(
                                origin = PaletteRampOrigin.REBUILD,
                                anchor = PaletteAnchor(500, "#654321"),
                                steps = mapOf(500 to "#654321", 600 to "#876543"),
                            )
                        },
                    )
                    fixture.palette.save(fixture.tenant, before.state, after)
                    DsResult.Success(Unit)
                },
            )
            val metadata = Json.parseToJsonElement(assertNotNull(result.mutationMetadata)).jsonArray
            assertEquals(
                listOf("palette-ramp"),
                metadata.map { it.jsonObject.getValue("entityType").jsonPrimitive.content },
            )
            assertEquals(emptyList(), metadata.flatMap { it.jsonObject.getValue("warnings").jsonArray })
            assertEquals("#654321", fixture.color(fixture.snapshot(), 500))
        }
    }

    @Test
    fun `component reference cleanup preserves history and rejects undo before token restoration`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val handlers = koinApplication { modules(componentsModule) }.let { application ->
                application.koin.getAll<DraftChangeHandler>().also { application.close() }
            }
            val fixture = Fixture(postgres, handlers)
            fixture.initialize()
            val tokenId = UUID.fromString(fixture.snapshot().tokens.single().id)
            val component = UUID.randomUUID()
            val property = UUID.randomUUID()
            val membership = UUID.randomUUID()
            val appearance = UUID.randomUUID()
            val valueId = UUID.randomUUID()
            val variation = UUID.randomUUID()
            val style = UUID.randomUUID()
            val variationValue = UUID.randomUUID()
            val combination = UUID.randomUUID()
            val member = UUID.randomUUID()
            fixture.mutate {
                TransactionManager.current().exec(
                    """
                    INSERT INTO components(id, name, platform) VALUES ('$component', 'Fixture', 'web');
                    INSERT INTO properties(id, component_id, name, type)
                        VALUES ('$property', '$component', 'color', 'value');
                    INSERT INTO design_system_components(id, design_system_id, component_id)
                        VALUES ('$membership', '${fixture.system.value}', '$component');
                    INSERT INTO design_system_component_revisions(
                        design_system_component_id, design_system_id,
                        design_system_version_id, version_sequence_number)
                        VALUES ('$membership', '${fixture.system.value}', '${fixture.draft}', 1);
                    INSERT INTO appearances(id, design_system_id, component_id)
                        VALUES ('$appearance', '${fixture.system.value}', '$component');
                    INSERT INTO appearance_revisions(
                        appearance_id, design_system_id, design_system_version_id, version_sequence_number, name)
                        VALUES ('$appearance', '${fixture.system.value}', '${fixture.draft}', 1, 'default');
                    INSERT INTO variations(id, design_system_id, component_id)
                        VALUES ('$variation', '${fixture.system.value}', '$component');
                    INSERT INTO variation_revisions(variation_id, design_system_id, design_system_version_id,
                        version_sequence_number, name)
                        VALUES ('$variation', '${fixture.system.value}', '${fixture.draft}', 1, 'size');
                    INSERT INTO styles(id, design_system_id, variation_id)
                        VALUES ('$style', '${fixture.system.value}', '$variation');
                    INSERT INTO style_revisions(style_id, design_system_id, design_system_version_id,
                        version_sequence_number, name)
                        VALUES ('$style', '${fixture.system.value}', '${fixture.draft}', 1, 'small');
                    INSERT INTO variation_property_values(id, property_id, style_id, appearance_id, design_system_id)
                        VALUES ('$variationValue', '$property', '$style', '$appearance', '${fixture.system.value}');
                    INSERT INTO variation_property_value_revisions(
                        variation_property_value_id, design_system_id, design_system_version_id,
                        version_sequence_number, token_id, alpha, adjustment, position, state_set_id)
                        VALUES ('$variationValue', '${fixture.system.value}', '${fixture.draft}', 1, '$tokenId',
                            '0.7', 'variation-adjustment', 3, '00000000-0000-4000-8000-0000000000ff');
                    INSERT INTO style_combinations(id, property_id, appearance_id, design_system_id)
                        VALUES ('$combination', '$property', '$appearance', '${fixture.system.value}');
                    INSERT INTO style_combination_revisions(style_combination_id, design_system_id,
                        design_system_version_id, version_sequence_number, combination_key, value, token_id,
                        alpha, adjustment, position, state_set_id)
                        VALUES ('$combination', '${fixture.system.value}', '${fixture.draft}', 1, '$style',
                            'fallback-value', '$tokenId', '0.6', 'combination-adjustment', 4,
                            '00000000-0000-4000-8000-0000000000ff');
                    INSERT INTO style_combination_members(id, combination_id, design_system_id)
                        VALUES ('$member', '$combination', '${fixture.system.value}');
                    INSERT INTO style_combination_member_revisions(style_combination_member_id, design_system_id,
                        design_system_version_id, version_sequence_number, style_id)
                        VALUES ('$member', '${fixture.system.value}', '${fixture.draft}', 1, '$style');
                    INSERT INTO invariant_property_values(
                        id, property_id, design_system_id, component_id, appearance_id)
                        VALUES ('$valueId', '$property', '${fixture.system.value}', '$component', '$appearance');
                    INSERT INTO invariant_property_value_revisions(
                        invariant_property_value_id, design_system_id, design_system_version_id,
                        version_sequence_number, token_id, position, state_set_id)
                        VALUES ('$valueId', '${fixture.system.value}', '${fixture.draft}', 1, '$tokenId', 0,
                            '00000000-0000-4000-8000-0000000000ff');
                    WITH additional AS (
                        SELECT gen_random_uuid() AS property_id, gen_random_uuid() AS value_id, n
                        FROM generate_series(1, 260) AS n
                    ), inserted_properties AS (
                        INSERT INTO properties(id, component_id, name, type)
                        SELECT property_id, '$component', 'color-' || n, 'value' FROM additional
                    ), inserted_values AS (
                        INSERT INTO invariant_property_values(
                            id, property_id, design_system_id, component_id, appearance_id)
                        SELECT value_id, property_id, '${fixture.system.value}', '$component', '$appearance'
                        FROM additional
                    )
                    INSERT INTO invariant_property_value_revisions(
                        invariant_property_value_id, design_system_id, design_system_version_id,
                        version_sequence_number, token_id, alpha, adjustment, position, state_set_id)
                    SELECT value_id, '${fixture.system.value}', '${fixture.draft}', 1, '$tokenId',
                        '0.5', 'preserved-adjustment', n, '00000000-0000-4000-8000-0000000000ff'
                    FROM additional;
                    """.trimIndent(),
                )
            }
            val published = fixture.publish()
            val references = ExposedPropertyValueRepository()
            val combinations = ExposedStyleCombinationRepository()
            val original = fixture.read(published) { references.listInvariant(PROJECT, false).associateBy { it.id } }
            val originalVariation = fixture.read(published) { references.listVariation(PROJECT, false).single() }
            val originalCombination = fixture.read(published) { combinations.list(PROJECT, false).single() }
            val originalMembers = fixture.read(published) { combinations.listMembers(PROJECT, false) }
            assertEquals(261, original.size)
            assertFailsWith<IllegalStateException> {
                fixture.mutate {
                    references.clear(fixture.system.value, setOf(tokenId))
                    error("Rollback batch cleanup")
                }
            }
            assertEquals(original, fixture.read { references.listInvariant(PROJECT, false).associateBy { it.id } })
            assertEquals(originalVariation, fixture.read { references.listVariation(PROJECT, false).single() })
            assertEquals(originalCombination, fixture.read { combinations.list(PROJECT, false).single() })
            fixture.mutate {
                ExposedColorTokenRepository(listOf(references)).deleteDefinitions(listOf(tokenId), tokenId)
            }
            val detached = fixture.read { references.listInvariant(PROJECT, false).associateBy { it.id } }
            val detachedVariation = fixture.read { references.listVariation(PROJECT, false).single() }
            val detachedCombination = fixture.read { combinations.list(PROJECT, false).single() }
            assertEquals(
                originalCombination.copy(tokenId = null, updatedAt = detachedCombination.updatedAt),
                detachedCombination,
            )
            assertEquals(originalCombination, fixture.read(published) { combinations.list(PROJECT, false).single() })
            assertEquals(originalMembers, fixture.read { combinations.listMembers(PROJECT, false) })
            assertEquals(
                originalVariation.copy(tokenId = null, value = null, updatedAt = detachedVariation.updatedAt),
                detachedVariation,
            )
            assertEquals(
                originalVariation,
                fixture.read(published) { references.listVariation(PROJECT, false).single() },
            )
            assertEquals(
                original.mapValues { (id, value) ->
                    value.copy(tokenId = null, value = null, updatedAt = detached.getValue(id).updatedAt)
                },
                detached,
            )
            assertEquals(
                original,
                fixture.read(published) { references.listInvariant(PROJECT, false).associateBy { it.id } },
            )
            val changes = assertNotNull(fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(
                com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount(changes, emptyMap()),
                fixture.read { fixture.journal.summary(PROJECT, false, fixture.system, null) },
            )
            assertEquals(261, changes.count { it.entityType == "invariant-property-value" })
            val reference = changes.single { it.entityType == "invariant-property-value" && it.entityId == valueId }
            val variationReference = changes.single { it.entityType == "variation-property-value" }
            val combinationReference = changes.single { it.entityType == "style-combination" }
            val token = changes.single { it.entityType == "token" }
            suspend fun revert(change: com.dsbuilder.ds.designsystems.domain.DraftChange) = fixture.mutate {
                fixture.journal.revert(PROJECT, false, fixture.system, change.changeId, change.editRevision, emptySet())
            }
            assertEquals(DraftChangeRevertResult.DependencyConflict, revert(reference))
            assertEquals(DraftChangeRevertResult.DependencyConflict, revert(combinationReference))
            assertTrue(fixture.read { references.listInvariant(PROJECT, false).all { it.tokenId == null } })
            assertEquals(DraftChangeRevertResult.Reverted, revert(token))
            assertEquals(DraftChangeRevertResult.Reverted, revert(combinationReference))
            assertEquals(tokenId, fixture.read { combinations.list(PROJECT, false).single().tokenId })
            assertEquals(DraftChangeRevertResult.Reverted, revert(reference))
            assertEquals(null, fixture.read { references.listVariation(PROJECT, false).single().tokenId })
            assertEquals(DraftChangeRevertResult.Reverted, revert(variationReference))
            assertEquals(tokenId, fixture.read { references.listVariation(PROJECT, false).single().tokenId })
            val restored = fixture.read { references.listInvariant(PROJECT, false).associateBy { it.id } }
            assertEquals(
                original.getValue(valueId).copy(updatedAt = restored.getValue(valueId).updatedAt),
                restored.getValue(valueId),
            )
            assertEquals(260, restored.values.count { it.tokenId == null })
            assertEquals(
                original,
                fixture.read(published) { references.listInvariant(PROJECT, false).associateBy { it.id } },
            )
            val tokenRepository = ExposedTokenRepository(listOf(references))
            val temporary = fixture.mutate {
                assertNotNull(
                    tokenRepository.createOwned(
                        PROJECT,
                        CreateToken(fixture.system.value, "temporary", TokenType.COLOR, null, null, true),
                    ),
                )
            }
            fixture.mutate {
                assertNotNull(
                    combinations.update(
                        PROJECT,
                        false,
                        combination,
                        StyleCombinationRepository.Update(null, temporary.id, true, null, false, null, false, null),
                    ),
                )
            }
            fixture.mutate { assertTrue(tokenRepository.deleteOwned(PROJECT, temporary.id)) }
            assertEquals(null, fixture.read { tokenRepository.findAccessible(PROJECT, temporary.id) })
            val afterTemporaryRemoval = fixture.read { combinations.list(PROJECT, false).single() }
            assertEquals(
                originalCombination.copy(tokenId = null, updatedAt = afterTemporaryRemoval.updatedAt),
                afterTemporaryRemoval,
            )
            assertEquals(originalMembers, fixture.read { combinations.listMembers(PROJECT, false) })
            assertEquals(originalCombination, fixture.read(published) { combinations.list(PROJECT, false).single() })
            val retained = fixture.mutate {
                assertNotNull(
                    tokenRepository.createOwned(
                        PROJECT,
                        CreateToken(fixture.system.value, "retained", TokenType.COLOR, null, null, true),
                    ),
                )
            }
            fixture.mutate {
                val update = PropertyValueRepository.ValueUpdate(
                    retained.id, true, null, false, null, false, null, false, null,
                )
                assertNotNull(references.updateInvariant(PROJECT, false, valueId, update))
                assertNotNull(references.updateVariation(PROJECT, false, variationValue, update))
                assertTrue(references.deleteInvariant(PROJECT, false, valueId))
                assertTrue(references.deleteVariation(PROJECT, false, variationValue))
                ExposedColorTokenRepository().replaceValues(
                    fixture.tenant,
                    mapOf(
                        retained.id to listOf(
                            ColorTokenValue(
                                ThemeTokenPlatform.WEB, ThemeTokenMode.LIGHT, null,
                                JsonArray(listOf(JsonPrimitive("#ABCDEF"))),
                            ),
                        ),
                    ),
                )
            }
            fixture.mutate { assertTrue(tokenRepository.deleteOwned(PROJECT, retained.id)) }
            assertEquals(null, fixture.read { tokenRepository.findAccessible(PROJECT, retained.id) })
            transaction(fixture.database) {
                exec("SELECT deleted FROM token_revisions WHERE token_id = '${retained.id}'") {
                    assertTrue(it.next())
                    assertTrue(it.getBoolean(1))
                }
                exec("SELECT count(*) FROM token_values WHERE token_id = '${retained.id}'") {
                    check(it.next())
                    assertEquals(0, it.getInt(1))
                }
            }
            val deletedProperties = assertNotNull(
                fixture.read {
                    fixture.journal.list(PROJECT, false, fixture.system, null)
                },
            ).filter { it.entityId in setOf(valueId, variationValue) }
            assertEquals(2, deletedProperties.size)
            deletedProperties.forEach { change ->
                val partial = fixture.mutate {
                    fixture.journal.revert(
                        PROJECT,
                        false,
                        fixture.system,
                        change.changeId,
                        change.editRevision,
                        setOf("/deleted"),
                    )
                }
                assertEquals(DraftChangeRevertResult.InvalidPaths, partial)
                assertEquals(DraftChangeRevertResult.Reverted, revert(change))
            }
            assertEquals(tokenId, fixture.read { references.findInvariant(PROJECT, false, valueId)?.tokenId })
            assertEquals(tokenId, fixture.read { references.findVariation(PROJECT, false, variationValue)?.tokenId })
            assertEquals(
                original,
                fixture.read(published) { references.listInvariant(PROJECT, false).associateBy { it.id } },
            )
            assertEquals(
                originalVariation,
                fixture.read(published) { references.listVariation(PROJECT, false).single() },
            )
        }
    }

    @Test
    fun `bulk color deletion preserves publication and restores token before its value`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            val published = fixture.publish()
            val original = fixture.snapshot(published)
            val tokenId = UUID.fromString(original.tokens.single().id)
            fixture.mutate { ExposedColorTokenRepository().deleteDefinitions(listOf(tokenId), tokenId) }
            assertEquals(emptyList(), fixture.snapshot().tokens)
            assertEquals(emptyList(), fixture.snapshot().values)
            assertEquals(original, fixture.snapshot(published))

            val changes = assertNotNull(fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(
                com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount(changes, emptyMap()),
                fixture.read { fixture.journal.summary(PROJECT, false, fixture.system, null) },
            )
            val token = changes.single { it.entityType == "token" }
            val value = changes.single { it.entityType == "token-value" }
            suspend fun revert(change: com.dsbuilder.ds.designsystems.domain.DraftChange) = fixture.mutate {
                fixture.journal.revert(PROJECT, false, fixture.system, change.changeId, change.editRevision, emptySet())
            }
            assertEquals(DraftChangeRevertResult.DependencyConflict, revert(value))
            assertEquals(DraftChangeRevertResult.Reverted, revert(token))
            assertEquals(DraftChangeRevertResult.Reverted, revert(value))
            assertEquals(original.tokens, fixture.snapshot().tokens)
            assertEquals(original.values, fixture.snapshot().values)
            assertEquals(original, fixture.snapshot(published))
        }
    }

    @Test
    fun `physical design system deletion keeps cascade compatible with palette history`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            fixture.publish()
            fixture.write(fixture.snapshot(), 500, "#ABCDEF")
            fixture.mutate {
                org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.current()
                    .exec("DELETE FROM design_systems WHERE id = '${fixture.system.value}'")
            }
            transaction(fixture.database) {
                exec("SELECT count(*) FROM tenant_palette_groups") { rows ->
                    check(rows.next())
                    assertEquals(0, rows.getInt(1))
                }
                exec("SELECT count(*) FROM tenant_palette_step_revisions") { rows ->
                    check(rows.next())
                    assertEquals(0, rows.getInt(1))
                }
            }
            Unit
        }
    }

    @Test
    fun `reference revert requires restoring deleted ramp first`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            fixture.publish()
            fixture.mutate {
                val before = assertNotNull(fixture.palette.snapshot(PROJECT, fixture.tenant))
                fixture.palette.rewriteTokenReferences(
                    fixture.tenant,
                    TokenReferenceRewrite(before.tokens.map { it.id }, fixture.slot, null),
                ) { step -> fixture.color(before, step) }
                fixture.palette.save(fixture.tenant, before.state, before.state.copy(ramps = emptyList()))
            }
            val changes = assertNotNull(fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(
                com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount(changes, emptyMap()),
                fixture.read { fixture.journal.summary(PROJECT, false, fixture.system, null) },
            )
            val token = changes.single { it.entityType == "token-value" }
            suspend fun revert(change: com.dsbuilder.ds.designsystems.domain.DraftChange) = fixture.mutate {
                fixture.journal.revert(PROJECT, false, fixture.system, change.changeId, change.editRevision, emptySet())
            }
            assertEquals(DraftChangeRevertResult.DependencyConflict, revert(token))
            assertEquals(changes, fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(DraftChangeRevertResult.Reverted, revert(changes.single { it.entityType == "palette-ramp" }))
            assertEquals(DraftChangeRevertResult.Reverted, revert(token))
            assertEquals(fixture.slot, fixture.snapshot().values.single().reference?.ramp)
            // Отмена удаления растяжки не отменяет автоматически правки ступеней.
            assertEquals(2, fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) }?.size)
        }
    }

    @Test
    fun `revert of occupied group name returns dependency conflict without partial changes`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            val group = StoredPaletteGroup(UUID.randomUUID().toString(), PaletteGroupKind.CUSTOM, null, "Original")
            fixture.mutate {
                val before = assertNotNull(fixture.palette.snapshot(PROJECT, fixture.tenant))
                fixture.palette.save(
                    fixture.tenant,
                    before.state,
                    before.state.copy(groups = before.state.groups + group),
                )
            }
            fixture.publish()
            fixture.mutate {
                val before = assertNotNull(fixture.palette.snapshot(PROJECT, fixture.tenant))
                val renamed = before.state.groups.map { if (it.id == group.id) it.copy(label = "Renamed") else it }
                fixture.palette.save(
                    fixture.tenant,
                    before.state,
                    before.state.copy(groups = renamed + group.copy(id = UUID.randomUUID().toString())),
                )
            }
            val changes = assertNotNull(fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(
                com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount(changes, emptyMap()),
                fixture.read { fixture.journal.summary(PROJECT, false, fixture.system, null) },
            )
            val renamed = changes.single { it.entityId.toString() == group.id }
            val reverted = fixture.mutate {
                fixture.journal.revert(
                    PROJECT,
                    false,
                    fixture.system,
                    renamed.changeId,
                    renamed.editRevision,
                    emptySet(),
                )
            }
            assertEquals(DraftChangeRevertResult.DependencyConflict, reverted)
            assertEquals("Renamed", fixture.snapshot().state.groups.single { it.id == group.id }.label)
            assertEquals(changes, fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
        }
    }

    @Test
    fun `partial color update preserves values of other platforms and published boundary`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            val token = UUID.fromString(fixture.snapshot().tokens.single().id)
            val tokens = ExposedColorTokenRepository()
            fixture.mutate {
                tokens.replaceValues(
                    fixture.tenant,
                    mapOf(
                        token to listOf(
                            ColorTokenValue(
                                ThemeTokenPlatform.IOS, ThemeTokenMode.LIGHT, null,
                                JsonArray(listOf(JsonPrimitive("#FFFFFF"))),
                            ),
                        ),
                    ),
                )
            }
            val published = fixture.publish()
            fixture.mutate {
                tokens.replaceValues(
                    fixture.tenant,
                    mapOf(
                        token to listOf(
                            ColorTokenValue(
                                ThemeTokenPlatform.WEB, ThemeTokenMode.LIGHT, null,
                                JsonArray(listOf(JsonPrimitive("#ABCDEF"))),
                            ),
                        ),
                    ),
                )
            }
            val changes = assertNotNull(fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) })
            assertEquals(
                com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount(changes, emptyMap()),
                fixture.read { fixture.journal.summary(PROJECT, false, fixture.system, null) },
            )
            assertEquals(1, changes.size)
            val changed = changes.single()
            assertEquals("token-value", changed.entityType)
            assertEquals(JsonPrimitive("web"), changed.currentValue?.get("platform"))
            assertEquals(JsonArray(listOf(JsonPrimitive("#ABCDEF"))), changed.currentValue?.get("value"))
            assertEquals(2, fixture.snapshot().values.size)
            assertEquals(listOf("ios", "web"), fixture.snapshot(published).values.map { it.platform }.sorted())
            assertEquals(
                fixture.snapshot(published).values.single { it.platform == "ios" },
                fixture.snapshot().values.single { it.platform == "ios" },
            )
        }
    }

    @Test
    fun `repeatable palette mutation stores response atomically and rejects changed payload`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            val key = UUID.randomUUID().toString()
            val request = fixture.context.copy(
                mutationRequest = IdempotentMutationRequest(
                    key,
                    "create-palette-group",
                    mapOf("label" to "Custom"),
                    201,
                ),
            ).withIdempotentResponse<String> { "\"$it\"" }
            var calls = 0
            suspend fun create(): DsResult<String> = fixture.transactions.required(request) {
                calls++
                val before = assertNotNull(fixture.palette.snapshot(PROJECT, fixture.tenant))
                val group = StoredPaletteGroup(UUID.randomUUID().toString(), PaletteGroupKind.CUSTOM, null, "Custom")
                fixture.palette.save(
                    fixture.tenant,
                    before.state,
                    before.state.copy(groups = before.state.groups + group),
                )
                DsResult.Success(group.id)
            }
            val created = assertIs<DsResult.Success<String>>(create()).value
            val replay = assertFailsWith<IdempotentReplayException> { create() }
            assertEquals(201, replay.response.status)
            assertEquals("\"$created\"", replay.response.body)
            assertEquals(1, calls)
            assertEquals(1, fixture.snapshot().state.groups.count { it.label == "Custom" })
            val mismatch = fixture.transactions.required(
                request.copy(
                    mutationRequest = request.mutationRequest?.copy(body = mapOf("label" to "Other")),
                ),
            ) {
                calls++
                DsResult.Success("invalid")
            }
            assertIs<DsFailure.Conflict>(assertIs<DsResult.Failure>(mismatch).error)
            assertEquals(1, calls)
            val failed = fixture.transactions.required(
                request.copy(
                    mutationRequest = request.mutationRequest?.copy(key = "failed-command"),
                ),
            ) {
                val before = assertNotNull(fixture.palette.snapshot(PROJECT, fixture.tenant))
                val group = StoredPaletteGroup(UUID.randomUUID().toString(), PaletteGroupKind.CUSTOM, null, "Rollback")
                fixture.palette.save(
                    fixture.tenant,
                    before.state,
                    before.state.copy(groups = before.state.groups + group),
                )
                DsResult.Failure(DsFailure.InvalidRequest("probe"))
            }
            assertIs<DsResult.Failure>(failed)
            assertEquals(0, fixture.snapshot().state.groups.count { it.label == "Rollback" })
            transaction(fixture.database) {
                exec("SELECT count(*) FROM idempotent_requests") { rows ->
                    check(rows.next())
                    assertEquals(1, rows.getInt(1))
                }
            }
            Unit
        }
    }

    @Test
    fun `step change journals once preserves published colors and reverts independently`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = Fixture(postgres)
            fixture.initialize()
            val initial = fixture.snapshot()
            val published = fixture.publish()
            val baseline = fixture.snapshot()
            fixture.write(baseline, 500, "#654321")
            fixture.write(baseline, 600, "#ABCDEF") // Второй запрос начал работу с прежнего состояния.

            val current = fixture.snapshot()
            assertEquals("#654321", fixture.color(current, 500))
            assertEquals("#ABCDEF", fixture.color(current, 600))
            val historical = fixture.snapshot(published)
            assertEquals(fixture.color(initial, 500), fixture.color(historical, 500))
            assertEquals(fixture.color(initial, 600), fixture.color(historical, 600))

            val changes = fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) }
            assertEquals(2, assertNotNull(changes).size)
            assertEquals(setOf("palette-step"), changes.map { it.entityType }.toSet())
            val step = changes.single { it.currentValue?.get("step") == JsonPrimitive(500) }
            assertEquals("editor-a", step.actorId)
            val reverted = fixture.mutate {
                fixture.journal.revert(PROJECT, false, fixture.system, step.changeId, step.editRevision, emptySet())
            }
            assertEquals(DraftChangeRevertResult.Reverted, reverted)
            val after = fixture.snapshot()
            assertEquals(fixture.color(initial, 500), fixture.color(after, 500))
            assertEquals("#ABCDEF", fixture.color(after, 600))
            assertEquals(1, fixture.read { fixture.journal.list(PROJECT, false, fixture.system, null) }?.size)
        }
    }

    private class Fixture(
        postgres: IsolatedPostgresDatabase,
        additionalHandlers: List<DraftChangeHandler> = emptyList(),
        private val materializeRamp: Boolean = true,
    ) {
        val database = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
        val transactions = ExposedTransactionRunner(database, PostgresTransactionFailureMapper())
        val system = DesignSystemId(UUID.randomUUID())
        val baseline = UUID.randomUUID()
        val draft = UUID.randomUUID()
        val palette = ExposedTenantPaletteRepository()
        val journal = ExposedDraftChangeRepository(
            listOf(designSystemDraftChangeHandler()) + themeDraftChangeHandlers() +
                tokenDraftChangeHandlers() + additionalHandlers,
            listOf(themeDraftChangePolicy()),
            listOf(PaletteRevertDependencyValidator(), ComponentTokenRevertDependencyValidator()),
        )
        lateinit var tenant: UUID
        val slot = PaletteRampRef(ThemePaletteType.GENERAL, "red")
        val context = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "editor-a", PROJECT.value, projectRole = "editor"),
            "palette-test",
            baseRevision = 0,
        )

        suspend fun initialize() {
            transaction(database) {
                exec(
                    "INSERT INTO design_systems(id, project_id, project_name) " +
                        "VALUES ('${system.value}', '${PROJECT.value}', 'fixture')",
                )
                exec(
                    """
                    INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at)
                        VALUES ('$baseline', '${system.value}', 'baseline', 0, 0, NULL);
                    INSERT INTO design_system_revisions(
                        design_system_id, design_system_version_id, version_sequence_number, name)
                        VALUES ('${system.value}', '$baseline', 0, 'Fixture');
                    INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at)
                        VALUES ('$draft', '${system.value}', 'draft', 1, 0, NULL);
                    INSERT INTO palette(type, shade, saturation, value) VALUES
                        ('general', 'red', 500, '#112233'), ('general', 'red', 600, '#334455');
                    """.trimIndent(),
                )
            }
            mutate {
                tenant = assertNotNull(
                    ExposedTenantRepository().createOwned(
                        PROJECT, CreateTenant(system.value, "Default", null, ColorConfiguration()),
                    ),
                ).id
                palette.initialize(tenant)
                val before = assertNotNull(palette.snapshot(PROJECT, tenant))
                val neutral = before.state.groups.single { it.systemKey == SystemPaletteGroup.NEUTRAL }
                val ramp = StoredPaletteRamp(
                    neutral.id,
                    slot,
                    slot,
                    true,
                    PaletteRampOrigin.TEMPLATE,
                    null,
                    mapOf(500 to "#123456", 600 to "#345678"),
                )
                if (materializeRamp) palette.save(tenant, before.state, before.state.copy(ramps = listOf(ramp)))
                val tokens = ExposedColorTokenRepository()
                val family = ColorTokenFamily(ThemeTokenType.COLOR, "text", "primary")
                val token = tokens.insertDefinitions(
                    system.value,
                    family,
                    listOf(family.defaultMember()),
                    null,
                    null,
                    null,
                    0,
                ).values.single()
                tokens.insertValues(
                    listOf(tenant),
                    mapOf(
                        token to listOf(
                            ColorTokenValue(
                                ThemeTokenPlatform.WEB, ThemeTokenMode.LIGHT, null,
                                JsonArray(listOf(JsonPrimitive("[general.red.500]"))),
                            ),
                        ),
                    ),
                )
                Unit
            }
        }

        suspend fun snapshot(version: UUID? = null): TenantPaletteSnapshot = read(version) {
            assertNotNull(palette.snapshot(PROJECT, tenant))
        }

        suspend fun write(before: TenantPaletteSnapshot, step: Int, value: String) = mutate {
            val next = before.state.copy(ramps = before.state.ramps.map { it.copy(steps = it.steps + (step to value)) })
            palette.save(tenant, before.state, next)
        }

        suspend fun rebuild(value: String, systemGroup: SystemPaletteGroup = SystemPaletteGroup.NEUTRAL) = mutate {
            val before = assertNotNull(palette.snapshot(PROJECT, tenant))
            val built = ThemePaletteBuilder.build(tenant.toString(), true, before.state, before.tokens, before.values)
            val group = before.state.groups.single { it.systemKey == systemGroup }.id
            val result = assertIs<PaletteOperationResult.Applied<*>>(
                PaletteOperations.rebuild(before.state, group, slot, 500, value, built),
            )
            palette.save(tenant, before.state, result.state)
        }

        suspend fun editStep(
            step: Int,
            value: String,
            systemGroup: SystemPaletteGroup = SystemPaletteGroup.NEUTRAL,
        ) = mutate {
            val before = assertNotNull(palette.snapshot(PROJECT, tenant))
            val built = ThemePaletteBuilder.build(tenant.toString(), true, before.state, before.tokens, before.values)
            val group = before.state.groups.single { it.systemKey == systemGroup }.id
            val result = assertIs<PaletteOperationResult.Applied<*>>(
                PaletteOperations.updateStep(before.state, group, slot, step, value, built),
            )
            palette.save(tenant, before.state, result.state)
        }

        fun color(snapshot: TenantPaletteSnapshot, step: Int): String? {
            val built = ThemePaletteBuilder.build(
                tenant.toString(),
                false,
                snapshot.state,
                snapshot.tokens,
                snapshot.values,
            )
            return ThemePaletteResolver.resolve(built, "text.default.primary", PaletteReference(slot, step, null))
        }

        suspend fun publish(): UUID {
            val cursor = transaction(database) {
                var revision = 0L
                exec("SELECT resolved_draft_revision('$draft')") { rows ->
                    check(rows.next())
                    revision = rows.getLong(1)
                }
                revision
            }
            val published = mutate {
                ExposedDesignSystemVersionRepository(journal).publish(
                    PROJECT,
                    CreateDesignSystemVersion(system, DesignSystemVersionId(draft), cursor, "0.1.0", ""),
                )
            }
            assertIs<PublishDesignSystemResult.Published>(published)
            return draft
        }

        suspend fun <T> mutate(block: suspend () -> T): T =
            assertIs<DsResult.Success<T>>(transactions.required(context) { DsResult.Success(block()) }).value

        suspend fun <T> read(version: UUID? = null, block: suspend () -> T): T =
            assertIs<DsResult.Success<T>>(
                transactions.readOnly(context.copy(versionId = version)) { DsResult.Success(block()) },
            ).value
    }

    private companion object {
        val PROJECT = ProjectId("palette-project")
    }
}
