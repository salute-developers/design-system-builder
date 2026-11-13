package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentTemplate
import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Порт шаблонов компонентов и добавления компонента в существующую дизайн-систему. */
interface ComponentTemplateRepository {
    /** Шаблоны web-компонентов, сопоставленные с компонентами глобального каталога. */
    suspend fun list(): List<ComponentTemplate>

    /**
     * Добавляет компонент в дизайн-систему вместе с отсутствующими зависимостями по шаблону: восстанавливает связь
     * компонента с сохранённой конфигурацией, иначе раскладывает шаблон в текущий черновик.
     *
     * Возвращает связь компонента или `null`, если дизайн-система или компонент недоступны. Нарушение предметных
     * правил (нет шаблона, не хватает метаданных или токенов) — [EditorRuleViolationException].
     */
    suspend fun addOwned(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentId: UUID,
    ): DesignSystemComponent?
}
