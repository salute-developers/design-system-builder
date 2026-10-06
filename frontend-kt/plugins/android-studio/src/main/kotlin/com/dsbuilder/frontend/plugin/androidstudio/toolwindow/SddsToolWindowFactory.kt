package com.dsbuilder.frontend.plugin.androidstudio.toolwindow

import androidx.compose.ui.awt.ComposePanel
import com.dsbuilder.frontend.plugin.androidstudio.theme.StudioTheme
import com.dsbuilder.frontend.plugin.androidstudio.ui.MainScreenState
import com.dsbuilder.frontend.plugin.androidstudio.ui.PluginRootScreen
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.JBColor
import com.intellij.ui.content.ContentFactory

/**
 * Фабрика tool window `SDDS` — встраивает Compose Desktop содержимое плагина через
 * [ComposePanel] в Swing-контент tool window.
 */
public class SddsToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        // Состояние навигации переживает пересоздание композиции при сворачивании/разворачивании панели.
        val mainState = MainScreenState()
        val composePanel = ComposePanel().apply {
            setContent {
                val isBrightIde = JBColor.isBright()
                StudioTheme(isBrightIde = isBrightIde) {
                    PluginRootScreen(mainState = mainState)
                }
            }
        }

        val content = ContentFactory.getInstance().createContent(composePanel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}
