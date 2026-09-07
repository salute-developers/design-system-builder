package com.dsbuilder.frontend.core.auth

/**
 * Runtime-доступ к env-переменным.
 */
public fun interface EnvironmentReader {
    /**
     * Возвращает значение env-переменной или `null`, если она не задана.
     */
    public fun get(name: String): String?
}
