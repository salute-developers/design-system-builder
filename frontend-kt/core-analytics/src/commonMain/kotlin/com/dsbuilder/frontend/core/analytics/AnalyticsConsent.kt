package com.dsbuilder.frontend.core.analytics

/** Подтверждение разрешения на один запуск клиента; не зависит от поставщика аналитики. */
public interface AnalyticsConsent {
    /** Проверяет сохранённый выбор один раз; вопрос доступен только интерактивному клиенту. */
    public suspend fun prepare(prompt: ((String) -> Boolean?)? = null)

    /** Проверяет в том числе локальный отзыв из другого процесса. */
    public suspend fun allowed(): Boolean

    /** Показывает уведомление и регистрирует явное разрешение. */
    public suspend fun enable(prompt: (String) -> Boolean?): String

    /** Немедленно запрещает сбор и сохраняет отзыв для отправки серверу. */
    public suspend fun disable(): String

    /** Возвращает только пользовательское состояние без ключей и токенов. */
    public suspend fun status(): String

    /** Закрывает только собственные сетевые ресурсы. */
    public fun close()
}
