package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId

/** Результат атомарной команды публикации. */
sealed interface PublishDesignSystemResult {
    /** Черновик успешно опубликован. */
    data class Published(
        /** Созданная неизменяемая публикация. */
        val version: DesignSystemVersion,
    ) : PublishDesignSystemResult

    /** Клиент указал уже неактуальный черновик или его редакцию. */
    data class DraftStale(
        /** Текущий идентификатор черновика. */
        val draftId: DesignSystemVersionId,
        /** Текущая редакция черновика. */
        val draftRevision: Long,
    ) : PublishDesignSystemResult

    /** Сохранённые настройки несовместимы с текущим Core. */
    data class CoreConflict(
        /** Полный отчёт, объясняющий отказ операции. */
        val report: com.dsbuilder.ds.core.application.CoreCompatibilityReport,
    ) : PublishDesignSystemResult

    /** В черновике нет предметных отличий. */
    data object EmptyDraft : PublishDesignSystemResult

    /** У дизайн-системы уже есть такой продуктовый номер версии. */
    data object VersionAlreadyExists : PublishDesignSystemResult

    /** Дизайн-система или активный черновик не найдены. */
    data object NotFound : PublishDesignSystemResult
}
