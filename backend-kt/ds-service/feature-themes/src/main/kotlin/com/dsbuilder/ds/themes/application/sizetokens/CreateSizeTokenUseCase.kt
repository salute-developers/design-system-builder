package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.colortokens.INVALID_TOKEN_NAME
import com.dsbuilder.ds.themes.application.colortokens.TOKEN_NAME_CONFLICT
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import com.dsbuilder.ds.themes.domain.sizetokens.SizePlatformValues
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueCheck
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueParser
import java.util.UUID

/**
 * Создаёт в активном черновике радиус, отступ или четыре варианта размера тени одной транзакцией: определения и
 * значения во всех темах дизайн-системы с `overridden: false`. Уникальность имени проверяется среди действующих
 * токенов под блокировкой ключа имени; повтор с тем же `Idempotency-Key` возвращает сохранённый ответ.
 */
class CreateSizeTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: SizeTokenRepository,
    private val usage: SizeTokenUsageRepository,
    private val palette: TenantPaletteRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Создание токена [command] в дизайн-системе темы [tenantId]. */
    @Suppress("ReturnCount")
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        command: CreateSizeToken,
    ): DsResult<CreatedSizeTokens> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        if (!SizeTokenNaming.validSegment(command.name)) {
            val message = "Имя токена — латиница в нижнем регистре, цифры и дефис"
            return DsResult.Failure(
                DsFailure.InvalidRequest(INVALID_TOKEN_NAME, details = mapOf("field" to "name"), message = message),
            )
        }
        val values = when (val check = values(command)) {
            is SizeValueCheck.Invalid -> return DsResult.Failure(check.violation.toFailure())
            is SizeValueCheck.Valid -> check.value
        }
        return transactions.required(context) {
            tokens.lock(context.projectId, tenantId)
                ?.let { designSystemId -> create(context, designSystemId, tenantId, command.kind, values) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }

    /** Полное имя → значение и ссылки цвета слоёв с полем запроса. */
    private fun values(command: CreateSizeToken): SizeValueCheck<List<NewValue>> =
        when (command.kind) {
            SizeTokenKind.SHADOW -> when (val check = SizeValueParser.variants(command.value)) {
                is SizeValueCheck.Invalid -> check
                is SizeValueCheck.Valid -> {
                    val byVariant = check.value.withIndex().associateBy { it.value.variant }
                    SizeValueCheck.Valid(
                        SizeTokenNaming.SHADOW_VARIANTS.map { variant ->
                            val (index, item) = byVariant.getValue(variant)
                            NewValue(
                                "$variant.${command.name}",
                                item.value,
                                SizeValueParser.colorReferences(item.value, "variants[$index]."),
                            )
                        },
                    )
                }
            }
            // Новый радиус и отступ получают одно значение веба: свои значения платформ при создании не задаются.
            else -> when (val check = SizeValueParser.parse(command.kind, command.value.copy(platforms = null))) {
                is SizeValueCheck.Invalid -> check
                is SizeValueCheck.Valid -> {
                    val name = SizeTokenNaming.fullNames(command.kind, command.name).single()
                    SizeValueCheck.Valid(listOf(NewValue(name, check.value, emptyList())))
                }
            }
        }

    @Suppress("ReturnCount")
    private suspend fun create(
        context: DsRequestContext,
        designSystemId: UUID,
        tenantId: UUID,
        kind: SizeTokenKind,
        values: List<NewValue>,
    ): DsResult<CreatedSizeTokens> {
        val colors = ShadowColorPalette(palette)
        colors.missingStep(tenantId, values.flatMap { it.references })?.let {
            return DsResult.Failure(missingPaletteStep(it))
        }
        val names = values.map { it.name }
        // Ключи имён — в едином порядке, как у общего создания токена: параллельные запросы одного имени идут подряд.
        names.map { it.trim().lowercase() }.sorted().forEach { uniqueKeys.lock(designSystemId, TOKEN_KEY, it) }
        tokens.takenNames(designSystemId, names).sorted().firstOrNull()?.let { taken ->
            return DsResult.Failure(
                DsFailure.Conflict(TOKEN_NAME_CONFLICT, message = "Токен $taken уже есть в дизайн-системе"),
            )
        }
        val ids = tokens.create(
            designSystemId,
            kind.type,
            values.associate { it.name to SizePlatformValues.write(kind, it.value) },
        )
        val created = ids.values.toSet()
        val stored = tokens.tokens(designSystemId, tenantId)
            .filter { it.id in created }
            .sortedBy { names.indexOf(it.name) }
        val resolve = colors.resolver(context.projectId, tenantId)
        return DsResult.Success(CreatedSizeTokens(kind, usage.views(designSystemId, stored, resolve)))
    }

    /** Значение нового токена с полным именем и ссылками цвета слоёв. */
    private data class NewValue(
        val name: String,
        val value: SizeTokenValue,
        val references: List<Pair<String, PaletteReference>>,
    )

    private companion object {
        /** Тот же предметный ключ уникальности, что у общего создания токена. */
        const val TOKEN_KEY = "token"
    }
}
