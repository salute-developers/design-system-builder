package com.dsbuilder.ds.themes.application.tokengroups

/** Use case групп токенов для маршрутов `token-groups`. */
data class TokenGroupUseCases(
    /** Список групп дизайн-системы. */
    val list: ListTokenGroupsUseCase,
    /** Создание группы или подгруппы. */
    val create: CreateTokenGroupUseCase,
    /** Переименование, перестановка, перенос подгруппы. */
    val update: UpdateTokenGroupUseCase,
    /** Удаление с подгруппами и токенами. */
    val delete: DeleteTokenGroupUseCase,
)
