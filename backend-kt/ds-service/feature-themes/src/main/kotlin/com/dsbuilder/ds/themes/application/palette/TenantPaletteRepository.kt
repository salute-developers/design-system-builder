package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState
import com.dsbuilder.ds.themes.domain.palette.TokenReferenceRewrite
import java.util.UUID

/** Хранилище палитры темы; вызывается внутри транзакции use case. */
interface TenantPaletteRepository {
    /**
     * Идемпотентно создаёт копию общей палитры (только если её ещё нет) и недостающие системные группы темы.
     * Нужна и для тем, созданных в обход `ds-service` (db-service `legacy/design-systems/create`).
     */
    suspend fun initialize(tenantId: UUID)

    /** Блокирует тему проекта `forUpdate` и сверяет ревизию. */
    suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int): TenantPaletteLock

    /**
     * Палитра темы, доступной проекту, или `null`. Берёт тему `FOR SHARE`, поэтому вызывается в изменяющей
     * транзакции: все чтения снимка согласованы с операциями палитры и `PUT token-values`.
     */
    suspend fun snapshot(projectId: ProjectId, tenantId: UUID): TenantPaletteSnapshot?

    /** Записывает группы, растяжки, ступени и привязки и ревизию темы из [state]. */
    suspend fun save(tenantId: UUID, state: TenantPaletteState)

    /**
     * Переписывает ссылки значений токенов темы при удалении растяжки в той же форме, что `PUT token-values`;
     * [resolveHex] даёт текущее значение ступени убираемой растяжки. Возвращает число изменённых значений.
     */
    suspend fun rewriteTokenReferences(
        tenantId: UUID,
        rewrite: TokenReferenceRewrite,
        resolveHex: (Int) -> String?,
    ): Int
}
