package com.dsbuilder.frontend.feature.theme.application

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Предметные операции семейств, цветовых групп и специализированных значений темы. */
@Serializable
public sealed interface ThemeEditCommand {
    /** Тема выбранной дизайн-системы. */
    public val tenantId: String

    /** Операция CreateFamily по контракту редактора темы. */
    @Serializable
    @SerialName("color_token_create")
    public data class CreateFamily(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Типизированные параметры записи. */
        public val input: ColorFamilyCreate,
    ) : ThemeEditCommand

    /** Операция UpdateFamily по контракту редактора темы. */
    @Serializable
    @SerialName("color_token_values_update")
    public data class UpdateFamily(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Идентификатор предметной сущности. */
        public val tokenId: String,
        /** Типизированные параметры записи. */
        public val input: ColorFamilyUpdate,
    ) : ThemeEditCommand

    /** Операция MoveFamily по контракту редактора темы. */
    @Serializable
    @SerialName("color_token_move")
    public data class MoveFamily(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Идентификатор предметной сущности. */
        public val tokenId: String,
        /** Типизированные параметры записи. */
        public val input: ColorFamilyMove,
    ) : ThemeEditCommand

    /** Операция DeleteFamily по контракту редактора темы. */
    @Serializable
    @SerialName("color_token_delete")
    public data class DeleteFamily(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Идентификатор предметной сущности. */
        public val tokenId: String,
        /** Типизированные параметры записи. */
        public val input: ColorFamilyDelete,
    ) : ThemeEditCommand

    /** Операция CreateGroup по контракту редактора темы. */
    @Serializable
    @SerialName("token_group_create")
    public data class CreateGroup(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Типизированные параметры записи. */
        public val input: ColorGroupCreate,
    ) : ThemeEditCommand

    /** Операция UpdateGroup по контракту редактора темы. */
    @Serializable
    @SerialName("token_group_update")
    public data class UpdateGroup(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Идентификатор предметной сущности. */
        public val groupId: String,
        /** Типизированные параметры записи. */
        public val input: ColorGroupUpdate,
    ) : ThemeEditCommand

    /** Операция DeleteGroup по контракту редактора темы. */
    @Serializable
    @SerialName("token_group_delete")
    public data class DeleteGroup(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Идентификатор предметной сущности. */
        public val groupId: String,
        /** Типизированные параметры записи. */
        public val input: ColorGroupDelete,
    ) : ThemeEditCommand

    /** Операция UpdateSize по контракту редактора темы. */
    @Serializable
    @SerialName("size_token_value_update")
    public data class UpdateSize(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Идентификатор предметной сущности. */
        public val tokenId: String,
        /** Типизированные параметры записи. */
        public val input: SizeValueUpdate,
    ) : ThemeEditCommand

    /** Операция UpdateTypography по контракту редактора темы. */
    @Serializable
    @SerialName("typography_style_update")
    public data class UpdateTypography(
        /** Тема выбранной системы. */
        public override val tenantId: String,
        /** Идентификатор предметной сущности. */
        public val tokenId: String,
        /** Типизированные параметры записи. */
        public val input: TypographyUpdate,
    ) : ThemeEditCommand
}
