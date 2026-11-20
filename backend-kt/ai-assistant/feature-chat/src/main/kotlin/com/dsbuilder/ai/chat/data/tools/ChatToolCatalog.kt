package com.dsbuilder.ai.chat.data.tools

import com.dsbuilder.ai.chat.application.ChatToolDefinition

/**
 * Полный список инструментов чата. Отбор по разрешениям выполняет агент, выполнение — порт
 * [com.dsbuilder.ai.chat.application.ChatToolExecutor]. С инструментами MCP совместимость не требуется.
 */
object ChatToolCatalog {
    /** Все инструменты чата. */
    val tools: List<ChatToolDefinition> = designSystemTools + tokenTools + themeTools + componentTools

    /** Имена инструментов каталога. */
    val names: Set<String> = tools.map { it.name }.toSet()
}
