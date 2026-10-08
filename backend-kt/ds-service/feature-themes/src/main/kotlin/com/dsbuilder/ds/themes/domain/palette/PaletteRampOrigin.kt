package com.dsbuilder.ds.themes.domain.palette

/** Происхождение значений растяжки в группе. */
enum class PaletteRampOrigin(
    /** Значение PostgreSQL enum `palette_ramp_origin` и контракта. */
    val wireValue: String,
) {
    TEMPLATE("template"),
    REBUILD("rebuild"),
    ;

    companion object {
        /** Возвращает происхождение по строковому контракту. */
        fun fromWire(value: String?): PaletteRampOrigin? = entries.firstOrNull { it.wireValue == value }
    }
}
