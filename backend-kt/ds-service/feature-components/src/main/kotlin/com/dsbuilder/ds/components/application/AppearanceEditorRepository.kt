package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.domain.EditorRemoval
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/**
 * Порт операций редактора оформления компонента.
 *
 * Операции изменения выполняются внутри транзакции use case по правилам многопользовательского редактирования.
 * Нарушение предметного правила репозиторий выражает [EditorRuleViolationException], отсутствие или недоступность
 * ресурса — значением `null`.
 */
@Suppress("TooManyFunctions")
interface AppearanceEditorRepository {
    /** Читает модель оформления; [versionId] выбирает опубликованную версию. */
    suspend fun model(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        versionId: UUID?,
    ): AppearanceEditorModel?

    /** Добавляет ось с значениями. */
    suspend fun addAxis(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AxisCreate,
    ): EditorAxis?

    /** Удаляет ось вместе с зависимыми значениями. */
    suspend fun removeAxis(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        confirmCascade: Boolean,
    ): EditorRemoval?

    /** Задаёт порядок осей. */
    suspend fun reorderAxes(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisIds: List<UUID>,
    ): List<EditorAxis>?

    /** Добавляет значение оси. */
    suspend fun addAxisValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        command: AxisValueCreate,
    ): EditorAxisValue?

    /** Удаляет значение оси вместе с зависимыми значениями. */
    suspend fun removeAxisValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        valueId: UUID,
        confirmCascade: Boolean,
    ): EditorRemoval?

    /** Задаёт порядок значений оси. */
    suspend fun reorderAxisValues(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        valueIds: List<UUID>,
    ): EditorAxis?

    /** Записывает значение свойства для области и набора состояний. */
    suspend fun setPropertyValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: PropertyValueSet,
    ): EditorPropertyValue?

    /** Удаляет значение свойства для области и набора состояний. */
    suspend fun removePropertyValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: PropertyValueScope,
    ): Boolean

    /** Задаёт порядок значений состояний свойства в области. */
    suspend fun reorderStates(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: StateOrder,
    ): List<EditorPropertyValue>?

    /** Создаёт пустую конфигурацию компонента. */
    suspend fun createAppearance(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: NewAppearance,
    ): Appearance?

    /** Дублирует конфигурацию. */
    suspend fun duplicateAppearance(
        projectId: ProjectId,
        systemAdmin: Boolean,
        sourceId: UUID,
        name: String?,
    ): Appearance?

    /** Читает оформление после создания. */
    suspend fun findAppearance(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Appearance?

    /** Команда добавления оси. */
    data class AxisCreate(
        /** Имя оси. */
        val name: String,
        /** Имена значений в порядке позиций. */
        val values: List<String>,
        /** Позиция оси; `null` — в конец. */
        val position: Int?,
        /** Имя значения по умолчанию; `null` — первое. */
        val defaultValue: String?,
    )

    /** Команда добавления значения оси. */
    data class AxisValueCreate(
        /** Имя значения. */
        val name: String,
        /** Позиция значения; `null` — в конец. */
        val position: Int?,
    )

    /** Область значения: свойство, стили и набор состояний. */
    data class PropertyValueScope(
        /** Свойство компонента. */
        val propertyId: UUID,
        /** Стили области: пусто для базы. */
        val styleIds: List<UUID>,
        /** Имена состояний набора. */
        val states: List<String>,
    )

    /** Ссылка на стиль вложенного компонента. */
    data class StyleReferenceInput(
        /** Оформление вложенного компонента. */
        val targetAppearanceId: UUID,
        /** Стили осей вложенного оформления. */
        val styleIds: List<UUID>,
    )

    /** Команда записи значения свойства. */
    data class PropertyValueSet(
        /** Область значения. */
        val scope: PropertyValueScope,
        /** Тип значения, объявленный клиентом. */
        val type: String?,
        /** Ссылка на токен. */
        val tokenId: UUID?,
        /** Литеральное значение. */
        val value: String?,
        /** Прозрачность. */
        val alpha: String?,
        /** Поправка. */
        val adjustment: String?,
        /** Ссылка на стиль вложенного компонента. */
        val reference: StyleReferenceInput?,
    )

    /** Команда переупорядочивания значений состояний свойства. */
    data class StateOrder(
        /** Свойство компонента. */
        val propertyId: UUID,
        /** Стили области. */
        val styleIds: List<UUID>,
        /** Наборы состояний в новом порядке. */
        val states: List<List<String>>,
    )

    /** Команда создания конфигурации. */
    data class NewAppearance(
        /** Дизайн-система. */
        val designSystemId: UUID,
        /** Компонент. */
        val componentId: UUID,
        /** Имя конфигурации; `null` — сформировать. */
        val name: String?,
    )
}
