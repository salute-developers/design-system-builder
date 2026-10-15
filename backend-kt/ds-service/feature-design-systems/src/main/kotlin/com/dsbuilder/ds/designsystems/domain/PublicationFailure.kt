package com.dsbuilder.ds.designsystems.domain

/** Ожидаемая предметная причина отказа публикации. */
sealed interface PublicationFailure {
    /** Черновик изменился после того, как пользователь прочитал журнал. */
    data class DraftStale(
        /** Актуальный идентификатор черновика. */
        val draftId: DesignSystemVersionId,
        /** Актуальная редакция черновика. */
        val draftRevision: Long,
    ) : PublicationFailure

    /** В черновике нет предметных отличий от предыдущей опубликованной границы. */
    data object EmptyDraft : PublicationFailure

    /** Продуктовый номер версии не соответствует поддерживаемому формату. */
    data object InvalidVersion : PublicationFailure

    /** Такой продуктовый номер уже опубликован в этой дизайн-системе. */
    data object VersionAlreadyExists : PublicationFailure
}
