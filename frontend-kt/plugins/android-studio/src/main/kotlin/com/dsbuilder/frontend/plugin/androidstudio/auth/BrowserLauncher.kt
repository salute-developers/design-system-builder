package com.dsbuilder.frontend.plugin.androidstudio.auth

/**
 * Порт открытия системного браузера. Отдельный интерфейс — чтобы [LoginController] не зависел
 * от IntelliJ Platform API напрямую и оставался тестируемым без запущенной IDE.
 */
public fun interface BrowserLauncher {
    /** Открывает [url] в системном браузере пользователя. */
    public fun browse(url: String)
}
