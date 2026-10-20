package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Хранилище стилей типографии темы; вызывается внутри транзакции use case. */
interface TypographyStyleRepository {
    /** Тема проекта для чтения или `null`, если её нет или она принадлежит другому проекту. */
    suspend fun tenant(projectId: ProjectId, tenantId: UUID): TypographyTenant?

    /** Блокирует тему проекта и сверяет её ревизию. */
    suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int): TypographyStyleLock

    /** Токен дизайн-системы [designSystemId] по идентификатору. */
    suspend fun token(designSystemId: UUID, tokenId: UUID): TypographyTokenLookup

    /**
     * Токены стилей дизайн-системы со значениями темы [tenantId]; при [style] — только токены этого стиля на всех
     * экранах. Токены с именем вне правила стиля в ответ не попадают.
     */
    suspend fun styles(
        designSystemId: UUID,
        tenantId: UUID,
        style: TypographyStyleKey? = null,
    ): List<StoredTypographyToken>

    /** Семейства шрифтов дизайн-системы с именем шрифта в теме [tenantId]. */
    suspend fun families(designSystemId: UUID, tenantId: UUID): List<TypographyFamily>

    /** Число тем дизайн-системы. */
    suspend fun themeCount(designSystemId: UUID): Int

    /** Записывает значения платформ токенов в тему [tenantId]; остальные значения не меняются. */
    suspend fun writeValues(tenantId: UUID, values: Map<UUID, Map<ThemeTokenPlatform, JsonElement>>)

    /** Увеличивает ревизию темы и возвращает новое значение. */
    suspend fun bumpRevision(tenantId: UUID): Int
}
