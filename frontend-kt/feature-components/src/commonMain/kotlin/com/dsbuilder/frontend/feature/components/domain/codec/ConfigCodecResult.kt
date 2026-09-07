package com.dsbuilder.frontend.feature.components.domain.codec

/**
 * Результат преобразования конфигурации компонента.
 *
 * Codec не бросает исключений и не пишет в поток вывода процесса: диагностика отказа
 * возвращается значением.
 */
internal sealed interface ConfigCodecResult<out T> {
    /**
     * Преобразование выполнено.
     *
     * @property value результат преобразования.
     */
    data class Success<T>(
        val value: T,
    ) : ConfigCodecResult<T>

    /**
     * Преобразование отклонено.
     *
     * @property reason причина отказа.
     */
    data class Failure(
        val reason: ConfigCodecFailure,
    ) : ConfigCodecResult<Nothing>
}

/**
 * Причина отказа преобразования.
 */
internal sealed interface ConfigCodecFailure {
    /**
     * Человекочитаемое описание отказа для вывода CLI.
     */
    val message: String

    /**
     * Текст не разбирается как конфигурация ожидаемого формата.
     *
     * @property detail диагностика разбора.
     */
    data class Unparsable(
        val detail: String,
    ) : ConfigCodecFailure {
        override val message: String get() = "Configuration cannot be parsed: $detail"
    }

    /**
     * Конфигурация объявляет вариации, но не объявляет оси.
     *
     * Оси не восстанавливаются разбором идентификаторов вариаций: такой разбор подставляет
     * пустые значения вместо отказа и тихо портит результат.
     *
     * @property variationCount число объявленных вариаций.
     */
    data class MissingBindings(
        val variationCount: Int,
    ) : ConfigCodecFailure {
        override val message: String
            get() = "Configuration declares $variationCount variations but no bindings."
    }

    /**
     * Вариация не объявляет `binding`.
     *
     * @property variationId идентификатор вариации.
     */
    data class MissingVariationBinding(
        val variationId: String,
    ) : ConfigCodecFailure {
        override val message: String
            get() = "Variation '$variationId' has no binding."
    }

    /**
     * Поле `key` вариации расходится с именем её собственной оси.
     *
     * @property variationId идентификатор вариации.
     * @property key объявленное значение `key`.
     * @property axis имя оси из последнего элемента `binding`.
     */
    data class KeyBindingMismatch(
        val variationId: String,
        val key: String,
        val axis: String,
    ) : ConfigCodecFailure {
        override val message: String
            get() = "Variation '$variationId' declares key '$key' but its own axis is '$axis'."
    }

    /**
     * Ссылка на ось, которая не объявлена в `bindings`.
     *
     * @property axis имя оси.
     * @property declared объявленные оси.
     */
    data class UnknownAxis(
        val axis: String,
        val declared: List<String>,
    ) : ConfigCodecFailure {
        override val message: String
            get() = "Axis '$axis' is not declared in bindings ${declared.joinToString(prefix = "[", postfix = "]")}."
    }

    /**
     * Конфигурация в common-формате не объявляет ось, на которую ссылается значение.
     *
     * @property axis идентификатор оси.
     */
    data class UnknownCommonAxis(
        val axis: String,
    ) : ConfigCodecFailure {
        override val message: String
            get() = "Common configuration references variation '$axis' that it does not declare."
    }

    /**
     * Родитель вариации не выводится: идентификатор составной, но ни один его точечный префикс
     * не принадлежит другой вариации.
     *
     * На корпусе такого не встречается — все 593 составных идентификатора двух пакетов находят
     * префикс. Отказ существует потому, что молчаливая альтернатива хуже: вариация без родителя
     * уезжает в корень дерева наследования, и собранная тема расходится без единого сигнала.
     *
     * @property variationId идентификатор вариации, родителя которой не нашлось.
     */
    data class UnresolvedVariationParent(
        val variationId: String,
    ) : ConfigCodecFailure {
        override val message: String
            get() = "Variation '$variationId' has a compound identifier but no known parent prefix."
    }
}
