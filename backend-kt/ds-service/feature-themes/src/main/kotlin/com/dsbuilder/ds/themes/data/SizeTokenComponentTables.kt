package com.dsbuilder.ds.themes.data

import org.jetbrains.exposed.v1.core.Table

// Таблицы конфигураций компонентов, которые читают токены размеров: только колонки ссылок на токены и смещений.
// Источник схемы — миграции Flyway `app/src/main/resources/db/migration`.

internal object SizeComponentsTable : Table("components") {
    val id = uuid("id")
    val name = text("name")
    val platform = postgresEnum(
        "platform",
        "component_platform",
        SizeComponentPlatform::fromWire,
        SizeComponentPlatform::wireValue,
    )
    override val primaryKey = PrimaryKey(id)
}

internal object SizeAppearancesTable : Table("appearances") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
    override val primaryKey = PrimaryKey(id)
}

internal object SizeVariationValuesTable : Table("variation_property_values") {
    val id = uuid("id")
    val appearanceId = uuid("appearance_id")
    val tokenId = uuid("token_id").nullable()
    val value = text("value").nullable()
    val adjustment = text("adjustment").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object SizeInvariantValuesTable : Table("invariant_property_values") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
    val tokenId = uuid("token_id").nullable()
    val value = text("value").nullable()
    val adjustment = text("adjustment").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object SizeStyleCombinationsTable : Table("style_combinations") {
    val id = uuid("id")
    val appearanceId = uuid("appearance_id")
    val tokenId = uuid("token_id").nullable()
    val value = text("value")
    val adjustment = text("adjustment").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object SizePlatformParamsTable : Table("property_platform_params") {
    val id = uuid("id")
    val platform = postgresEnum(
        "platform",
        "component_platform",
        SizeComponentPlatform::fromWire,
        SizeComponentPlatform::wireValue,
    )
    val name = text("name")
    override val primaryKey = PrimaryKey(id)
}

internal object SizeVariationAdjustmentsTable : Table("variation_platform_param_adjustments") {
    val id = uuid("id")
    val vpvId = uuid("vpv_id")
    val platformParamId = uuid("platform_param_id")
    val value = text("value").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object SizeInvariantAdjustmentsTable : Table("invariant_platform_param_adjustments") {
    val id = uuid("id")
    val ipvId = uuid("ipv_id")
    val platformParamId = uuid("platform_param_id")
    val value = text("value").nullable()
    override val primaryKey = PrimaryKey(id)
}

/** Платформа компонента и платформенного параметра (`component_platform`). */
internal enum class SizeComponentPlatform(val wireValue: String) {
    WEB("web"),
    XML("xml"),
    COMPOSE("compose"),
    IOS("ios"),
    ;

    /** Приоритет поправки при разных смещениях по платформам: web, затем xml, compose, ios. */
    val priority: Int
        get() = ordinal

    companion object {
        fun fromWire(value: String): SizeComponentPlatform? = entries.firstOrNull { it.wireValue == value }
    }
}
