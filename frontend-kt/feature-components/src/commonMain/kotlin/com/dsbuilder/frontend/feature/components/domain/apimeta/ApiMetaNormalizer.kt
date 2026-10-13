package com.dsbuilder.frontend.feature.components.domain.apimeta

/**
 * Приводит API-мету одной платформы к манифесту.
 *
 * Форматы мет Compose, View и iOS различаются корнем, именем компонента и описанием состояний, поэтому
 * у каждой платформы свой нормализатор, а общий у них только результат.
 */
internal interface ApiMetaNormalizer {
    /**
     * Разбирает мету и строит манифест.
     *
     * @param text содержимое файла меты.
     * @param typeMap подмена типа `from → to`, применяемая до отправки.
     */
    fun normalize(text: String, typeMap: Map<String, String> = emptyMap()): ApiMetaNormalizationResult
}

/** Результат нормализации меты. */
internal sealed interface ApiMetaNormalizationResult {
    /**
     * Мета разобрана.
     *
     * @property manifest манифест для отправки.
     * @property conflicts повторы свойства с другим типом: побеждает первое вхождение.
     * @property skipped то, что нормализатор сознательно не включил в манифест.
     */
    data class Normalized(
        val manifest: ApiMetaManifest,
        val conflicts: List<String>,
        val skipped: List<ApiMetaSkipped> = emptyList(),
    ) : ApiMetaNormalizationResult

    /**
     * Мета пуста: плагин записывает пустую мету, если артефакт uikit не найден на classpath.
     */
    data object Empty : ApiMetaNormalizationResult

    /**
     * Содержимое не соответствует формату меты платформы.
     *
     * @property message причина.
     */
    data class Invalid(val message: String) : ApiMetaNormalizationResult
}

/**
 * Категория свойств, которые нормализатор не включил в манифест, и их число.
 *
 * Число считается по уникальным парам `(компонент, id)`, то есть в тех же единицах, что и свойства
 * манифеста; пара, свойство которой всё же попало в манифест из другой записи, не считается пропущенной.
 *
 * @property category описание категории для вывода (`properties of type unknown`).
 * @property count число пропущенных свойств.
 */
public data class ApiMetaSkipped(
    public val category: String,
    public val count: Int,
)
