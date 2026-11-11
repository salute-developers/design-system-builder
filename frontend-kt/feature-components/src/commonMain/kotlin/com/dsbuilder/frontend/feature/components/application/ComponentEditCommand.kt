package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.FieldChange
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Закрытый набор команд редактора конфигураций компонентов. */
@Serializable
public sealed interface ComponentEditCommand {
    /** Предметная операция CreateConfiguration. */
    @Serializable
    @SerialName("component_configuration_create")
    public data class CreateConfiguration(
        /** Параметр componentId предметного контракта. */
        public val componentId: String,
        /** Параметр name предметного контракта. */
        public val name: String? = null,
    ) : ComponentEditCommand

    /** Предметная операция DuplicateConfiguration. */
    @Serializable
    @SerialName("component_configuration_duplicate")
    public data class DuplicateConfiguration(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр name предметного контракта. */
        public val name: String? = null,
    ) : ComponentEditCommand

    /** Предметная операция UpdateConfiguration. */
    @Serializable
    @SerialName("component_configuration_update")
    public data class UpdateConfiguration(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр name предметного контракта. */
        public val name: String,
    ) : ComponentEditCommand

    /** Предметная операция DeleteConfiguration. */
    @Serializable
    @SerialName("component_configuration_delete")
    public data class DeleteConfiguration(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
    ) : ComponentEditCommand

    /** Предметная операция CreateAxis. */
    @Serializable
    @SerialName("component_axis_create")
    public data class CreateAxis(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр input предметного контракта. */
        public val input: AxisCreateInput,
    ) : ComponentEditCommand

    /** Предметная операция UpdateAxis. */
    @Serializable
    @SerialName("component_axis_update")
    public data class UpdateAxis(
        /** Параметр axisId предметного контракта. */
        public val axisId: String,
        /** Параметр position предметного контракта. */
        public val position: Int? = null,
        /** Параметр defaultStyleId предметного контракта. */
        @Serializable(with = StringFieldChangeSerializer::class)
        public val defaultStyleId: FieldChange<String> = FieldChange.Unchanged,
        /** Параметр isRoot предметного контракта. */
        public val isRoot: Boolean? = null,
        /** Параметр isColorScheme предметного контракта. */
        public val isColorScheme: Boolean? = null,
        /** Параметр declaredType предметного контракта. */
        @Serializable(with = StringFieldChangeSerializer::class)
        public val declaredType: FieldChange<String> = FieldChange.Unchanged,
        /** Параметр displayName предметного контракта. */
        @Serializable(with = StringFieldChangeSerializer::class)
        public val displayName: FieldChange<String> = FieldChange.Unchanged,
    ) : ComponentEditCommand

    /** Предметная операция DeleteAxis. */
    @Serializable
    @SerialName("component_axis_delete")
    public data class DeleteAxis(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр axisId предметного контракта. */
        public val axisId: String,
        /** Параметр confirmCascade предметного контракта. */
        public val confirmCascade: Boolean = false,
    ) : ComponentEditCommand

    /** Предметная операция ReorderAxes. */
    @Serializable
    @SerialName("component_axes_reorder")
    public data class ReorderAxes(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр axisIds предметного контракта. */
        public val axisIds: List<String>,
    ) : ComponentEditCommand

    /** Предметная операция CreateAxisValue. */
    @Serializable
    @SerialName("component_axis_value_create")
    public data class CreateAxisValue(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр axisId предметного контракта. */
        public val axisId: String,
        /** Параметр input предметного контракта. */
        public val input: AxisValueCreateInput,
    ) : ComponentEditCommand

    /** Предметная операция UpdateAxisValue. */
    @Serializable
    @SerialName("component_axis_value_update")
    public data class UpdateAxisValue(
        /** Параметр valueId предметного контракта. */
        public val valueId: String,
        /** Параметр position предметного контракта. */
        public val position: Int? = null,
        /** Параметр authoredId предметного контракта. */
        @Serializable(with = StringFieldChangeSerializer::class)
        public val authoredId: FieldChange<String> = FieldChange.Unchanged,
        /** Параметр displayName предметного контракта. */
        @Serializable(with = StringFieldChangeSerializer::class)
        public val displayName: FieldChange<String> = FieldChange.Unchanged,
    ) : ComponentEditCommand

    /** Предметная операция DeleteAxisValue. */
    @Serializable
    @SerialName("component_axis_value_delete")
    public data class DeleteAxisValue(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр valueId предметного контракта. */
        public val valueId: String,
        /** Параметр confirmCascade предметного контракта. */
        public val confirmCascade: Boolean = false,
    ) : ComponentEditCommand

    /** Предметная операция ReorderAxisValues. */
    @Serializable
    @SerialName("component_axis_values_reorder")
    public data class ReorderAxisValues(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр axisId предметного контракта. */
        public val axisId: String,
        /** Параметр valueIds предметного контракта. */
        public val valueIds: List<String>,
    ) : ComponentEditCommand

    /** Предметная операция SetProperty. */
    @Serializable
    @SerialName("component_property_set")
    public data class SetProperty(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр input предметного контракта. */
        public val input: PropertySetInput,
    ) : ComponentEditCommand

    /** Предметная операция ResetProperty. */
    @Serializable
    @SerialName("component_property_reset")
    public data class ResetProperty(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр propertyId предметного контракта. */
        public val propertyId: String,
        /** Параметр styleIds предметного контракта. */
        public val styleIds: List<String> = emptyList(),
        /** Параметр states предметного контракта. */
        public val states: List<String> = emptyList(),
    ) : ComponentEditCommand

    /** Предметная операция ReorderStates. */
    @Serializable
    @SerialName("component_states_reorder")
    public data class ReorderStates(
        /** Параметр appearanceId предметного контракта. */
        public val appearanceId: String,
        /** Параметр input предметного контракта. */
        public val input: StatesOrderInput,
    ) : ComponentEditCommand
}
