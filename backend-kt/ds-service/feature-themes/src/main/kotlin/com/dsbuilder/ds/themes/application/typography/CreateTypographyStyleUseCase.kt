package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleNaming
import java.util.UUID
import kotlin.math.abs

/**
 * Создаёт в активном черновике стиль типографии — девять токенов `<экран>.<группа>.<размер>.<начертание>` — одной
 * транзакцией. Значения во всех темах копируются у ближайшего размера той же группы того же экрана и начертания,
 * в пустой группе — у `body.m`.
 */
class CreateTypographyStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TypographyStyleRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Создание стиля [style] в дизайн-системе темы [tenantId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        style: TypographyStyleKey,
    ): DsResult<TypographyStyleTokens> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        invalidStyleName(style.group, style.size)?.let { return DsResult.Failure(it) }
        return transactions.required(context) {
            when (val lock = repository.lock(context.projectId, tenantId)) {
                is TypographyStyleLock.Locked -> create(lock.designSystemId, tenantId, style)
                TypographyStyleLock.NotFound -> DsResult.Failure(DsFailure.NotFound)
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun create(
        designSystemId: UUID,
        tenantId: UUID,
        style: TypographyStyleKey,
    ): DsResult<TypographyStyleTokens> {
        repository.claimStyle(uniqueKeys, designSystemId, style)?.let { return DsResult.Failure(it) }
        val tokens = repository.styles(designSystemId, tenantId)
        val source = source(tokens, style)
            ?: return DsResult.Failure(invalidTypographyStyle("В дизайн-системе нет стиля, у которого взять значения"))
        val sources = TypographyStyleNaming.names(style).associateWith { name ->
            val missing = "У стиля $source нет токена ${name.copy(style = source)}"
            tokens.firstOrNull { it.name == name.copy(style = source) }?.id
                ?: return DsResult.Failure(invalidTypographyStyle(missing))
        }
        val created = repository.createStyle(designSystemId, sources)
        return DsResult.Success(TypographyStyleTokens(created.values.toList()))
    }

    /** Стиль, у которого берутся значения: ближайший размер группы по шкале, иначе `body.m`, иначе первый стиль. */
    private fun source(tokens: List<StoredTypographyToken>, style: TypographyStyleKey): TypographyStyleKey? {
        val styles = tokens.map { it.name.style }.distinct().sorted()
        val rank = TypographyStyleKey.sizeRank(style.size)
        return styles.filter { it.group == style.group }
            .minByOrNull { candidate -> distance(TypographyStyleKey.sizeRank(candidate.size), rank) }
            ?: styles.firstOrNull { it == DEFAULT_SOURCE }
            ?: styles.firstOrNull()
    }

    private fun distance(left: Int, right: Int): Long =
        if (left == Int.MAX_VALUE || right == Int.MAX_VALUE) Long.MAX_VALUE / 2 else abs(left.toLong() - right)

    private companion object {
        val DEFAULT_SOURCE = TypographyStyleKey("body", "m")
    }
}
