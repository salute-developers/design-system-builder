package com.dsbuilder.frontend.core.analytics

/** Неблокирующая регистрация событий; реализация выбирается клиентом. */
public interface Analytics {
    /** Принимает снимок события без ожидания сети. */
    public fun track(event: AnalyticsEvent)

    /** Ограниченно ожидает попытки отправки ранее принятых событий, сохраняя отмену вызывающего кода. */
    public suspend fun flush(timeoutMillis: Long): AnalyticsFlushResult

    /** Идемпотентно освобождает ресурсы; новые события после закрытия игнорируются. */
    public fun close()
}

/** Результат ожидания, не гарантирующий появления данных у поставщика. */
public enum class AnalyticsFlushResult { COMPLETED, TIMED_OUT, DISABLED }

/**
 * Контекст приложения без идентификаторов поставщика.
 * @property clientType режим приложения из каталога клиента.
 * @property clientVersion версия клиентского приложения.
 * @property osFamily семейство ОС без имени устройства.
 */
public data class AnalyticsContext(
    public val clientType: String,
    public val clientVersion: String,
    public val osFamily: String,
)

/** Допустимое скалярное значение свойства события. */
public sealed interface AnalyticsValue {
    /**
     * Строковое значение из разрешённого клиентом каталога.
     * @property value строковый скаляр.
     */
    public data class Text(public val value: String) : AnalyticsValue

    /**
     * Логический признак.
     * @property value значение признака.
     */
    public data class Flag(public val value: Boolean) : AnalyticsValue

    /**
     * Конечное числовое значение.
     * @property value число, исключающее NaN и бесконечности.
     */
    public data class Number(public val value: Double) : AnalyticsValue {
        init { require(value.isFinite()) }
    }
}

/**
 * Неизменяемый снимок события; пользовательские аргументы не являются аналитическими свойствами.
 * @property name фиксированное имя типа события.
 * @property occurredAtEpochSeconds время завершения операции в секундах Unix.
 * @property properties снимок разрешённых скалярных свойств.
 */
public class AnalyticsEvent(
    public val name: String,
    public val occurredAtEpochSeconds: Long,
    properties: Map<String, AnalyticsValue>,
) {
    /** Снимок свойств, не связанный с изменяемой картой вызывающего кода. */
    public val properties: Map<String, AnalyticsValue> = properties.toMap()
}

/** Отключённая аналитика без сетевых, файловых и фоновых действий. */
public object NoOpAnalytics : Analytics {
    override fun track(event: AnalyticsEvent): Unit = Unit
    override suspend fun flush(timeoutMillis: Long): AnalyticsFlushResult = AnalyticsFlushResult.DISABLED
    override fun close(): Unit = Unit
}
