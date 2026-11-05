package com.dsbuilder.ds.themes.application.typography

/** Use case стилей типографии для маршрутов `/typography-styles` и `/typography-groups`. */
data class TypographyStyleUseCases(
    /** Чтение стилей темы. */
    val get: GetTypographyStylesUseCase,
    /** Изменение стиля. */
    val update: UpdateTypographyStyleUseCase,
    /** Создание стиля. */
    val create: CreateTypographyStyleUseCase,
    /** Переименование стиля. */
    val rename: RenameTypographyStyleUseCase,
    /** Удаление стиля. */
    val delete: DeleteTypographyStyleUseCase,
    /** Переименование своей группы. */
    val renameGroup: RenameTypographyGroupUseCase,
    /** Удаление своей группы. */
    val deleteGroup: DeleteTypographyGroupUseCase,
)
