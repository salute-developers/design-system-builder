package com.dsbuilder.frontend.feature.theme.application

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Тело `POST /tenants/{tenantId}/color-tokens`. */
@Serializable
public data class ColorFamilyCreate(
    /** Ожидаемая ревизия текущей темы. */
    public val editRevision: Int,
    /** Тип: `color` или `gradient`. */
    public val type: String,
    /** Группа, например `text`. */
    public val group: String,
    /** Имя без подгруппы и состояния. */
    public val name: String,
    /** Отображаемое имя. */
    public val displayName: String? = null,
    /** Описание. */
    public val description: String? = null,
    /** Группа палитры текущей темы. */
    public val paletteGroupId: String? = null,
    /** Члены семейства с начальными значениями. */
    public val members: List<ColorFamilyMember>,
    /** Группа или подгруппа токенов
без неё токен создаётся без группы. */
    public val groupId: String? = null,
    /** Позиция в группе
без неё — в конец. */
    public val position: Int? = null,
)

/** Тело `PUT /tenants/{tenantId}/color-tokens/{tokenId}/values`. */
@Serializable
public data class ColorFamilyUpdate(
    /** Ожидаемая ревизия текущей темы. */
    public val editRevision: Int,
    /** Члены семейства с новыми значениями. */
    public val members: List<ColorFamilyMemberUpdate>,
)

/** Тело `POST /tenants/{tenantId}/color-tokens/{tokenId}/move`. */
@Serializable
public data class ColorFamilyMove(
    /** Ожидаемая ревизия текущей темы. */
    public val editRevision: Int,
    /** Группа или подгруппа назначения. */
    public val groupId: String,
    /** Позиция в ней. */
    public val position: Int,
    /** Новое имя без группы и состояния. */
    public val name: String? = null,
)

/** Тело `DELETE /tenants/{tenantId}/color-tokens/{tokenId}`. */
@Serializable
public data class ColorFamilyDelete(
    /** Ожидаемая ревизия текущей темы. */
    public val editRevision: Int,
)

/** Член семейства существующего токена с новыми значениями. */
@Serializable
public data class ColorFamilyMemberUpdate(
    /** Идентификатор определения. */
    public val tokenId: String,
    /** Значения для платформ и режимов. */
    public val values: List<ColorFamilyValue>,
)

/** Член семейства нового токена со значениями. */
@Serializable
public data class ColorFamilyMember(
    /** Полное имя без режима, например `text.on-dark.accent-hover`. */
    public val name: String,
    /** Значения для платформ и режимов. */
    public val values: List<ColorFamilyValue>,
)

/** Значение определения цветового токена для платформы и режима. */
@Serializable
public data class ColorFamilyValue(
    /** Платформа: `web`, `ios` или `android`. */
    public val platform: String,
    /** Режим: `light` или `dark`. */
    public val mode: String,
    /** Ссылка на запись общей палитры. */
    public val paletteId: String? = null,
    /** JSON-значение: цвет, web-градиент или слои iOS и Android. */
    public val value: JsonElement,
    /** Базовая редакция этой пары платформа/режим. */
    public val baseRevision: Long? = null,
    /** Своё значение iOS или Android, а не построенное из web
у web допустимо только `false`. */
    public val overridden: Boolean = false,
)

/** Тело `POST /tenants/{tenantId}/token-groups`. */
@Serializable
public data class ColorGroupCreate(
    /** Ожидаемая ревизия текущей темы. */
    public val editRevision: Int,
    /** Вид токенов: `color`. */
    public val kind: String,
    /** Группа для подгруппы
`null` — группа верхнего уровня. */
    public val parentId: String? = null,
    /** Название. */
    public val label: String,
    /** Позиция среди соседей
без неё — в конец. */
    public val position: Int? = null,
)

/** Тело `PATCH /tenants/{tenantId}/token-groups/{groupId}`. */
@Serializable
public data class ColorGroupUpdate(
    /** Ожидаемая ревизия текущей темы. */
    public val editRevision: Int,
    /** Новое название. */
    public val label: String? = null,
    /** Новая группа подгруппы. */
    public val parentId: String? = null,
    /** Новая позиция среди соседей. */
    public val position: Int? = null,
)

/** Тело `DELETE /tenants/{tenantId}/token-groups/{groupId}`. */
@Serializable
public data class ColorGroupDelete(
    /** Ожидаемая ревизия текущей темы. */
    public val editRevision: Int,
)

/**
 * Тело `PUT /tenants/{tenantId}/size-tokens/{tokenId}/value`: `valuePx` у радиуса и отступа, `layers`
 * и `fallbackElevation` у тени. Поля значения принимаются как есть и проверяются по типу токена.
 */
@Serializable
public data class SizeValueUpdate(
    /** Значение радиуса или отступа в px. */
    public val valuePx: JsonElement? = null,
    /** Слои тени. */
    public val layers: JsonElement? = null,
    /** Запасная высота Android. */
    public val fallbackElevation: JsonElement? = null,
    /** Свои значения платформ `{ ios, android }`: число у радиуса и отступа, `{ layers }` у тени. */
    public val platforms: JsonElement? = null,
    /**
     * Базовые технические редакции значений по платформам `web`, `ios`, `android` из чтения значений темы;
     * приоритетнее заголовка `X-DS-Base-Revision`.
     */
    public val baseRevisions: Map<String, Long>? = null,
)

/** Тело `PATCH /tenants/{tenantId}/typography-styles/{tokenId}`. */
@Serializable
public data class TypographyUpdate(
    /** Размер в px. */
    public val size: Double? = null,
    /** Высота строки в px. */
    public val lineHeight: Double? = null,
    /** Трекинг в em. */
    public val letterSpacing: Double? = null,
    /** Веса начертаний: `normal`, `medium`, `bold` → вес. */
    public val weights: Map<String, Int>? = null,
    /** Семейство шрифта: имя токена `fontFamily`. */
    public val fontFamily: String? = null,
    /** Платформа своего значения: `ios` или `android`
без неё правка относится к вебу. */
    public val platform: String? = null,
    /** Базовые редакции значений токенов стиля
приоритетнее заголовка `X-DS-Base-Revision`. */
    public val baseRevisions: List<TypographyValueRevision>? = null,
)

/** Базовая редакция значения токена стиля на платформе в теле изменения. */
@Serializable
public data class TypographyValueRevision(
    /** Идентификатор токена стиля. */
    public val tokenId: String,
    /** Платформа: `web`, `ios`, `android`. */
    public val platform: String,
    /** Техническая редакция значения, с которой клиент начал правку. */
    public val baseRevision: Long,
)
