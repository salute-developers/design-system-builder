package com.dsbuilder.ds.themes.application.palette

/** Use case палитры темы для маршрутов `/api/ds/tenants/{tenantId}/palette`. */
data class TenantPaletteUseCases(
    /** Чтение палитры. */
    val get: GetTenantPaletteUseCase,
    /** Связи слота. */
    val links: ListTenantPaletteLinksUseCase,
    /** Создание группы. */
    val createGroup: CreateTenantPaletteGroupUseCase,
    /** Переименование группы. */
    val renameGroup: RenameTenantPaletteGroupUseCase,
    /** Удаление группы. */
    val deleteGroup: DeleteTenantPaletteGroupUseCase,
    /** Привязка токена к группе. */
    val assignTokenGroup: AssignTenantPaletteTokenGroupUseCase,
    /** Добавление растяжки. */
    val addRamp: AddTenantPaletteRampUseCase,
    /** Замена источника. */
    val replaceSource: ReplaceTenantPaletteRampSourceUseCase,
    /** Превью перестройки. */
    val previewRebuild: PreviewTenantPaletteRampRebuildUseCase,
    /** Перестройка. */
    val rebuild: RebuildTenantPaletteRampUseCase,
    /** Правка ступени. */
    val updateStep: UpdateTenantPaletteStepUseCase,
    /** Удаление растяжки. */
    val removeRamp: RemoveTenantPaletteRampUseCase,
)
