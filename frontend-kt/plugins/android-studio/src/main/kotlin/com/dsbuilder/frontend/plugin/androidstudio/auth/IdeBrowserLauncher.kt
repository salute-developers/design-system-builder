package com.dsbuilder.frontend.plugin.androidstudio.auth

import com.intellij.ide.BrowserUtil

/**
 * [BrowserLauncher] поверх стандартного IntelliJ Platform `BrowserUtil`.
 */
public class IdeBrowserLauncher : BrowserLauncher {
    override fun browse(url: String) {
        BrowserUtil.browse(url)
    }
}
