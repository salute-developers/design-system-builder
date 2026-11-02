package com.dsbuilder.frontend.core.domain

/** Переносимый выбор авторизации локального config без секретов. */
public sealed interface InitCredentialSelection {
    /** Использовать сохранённую пользовательскую сессию. */
    public data object UserSession : InitCredentialSelection

    /** Читать project key из окружения.
     * @property name имя переменной, не значение секрета.
     */
    public data class Environment(public val name: String) : InitCredentialSelection
}
