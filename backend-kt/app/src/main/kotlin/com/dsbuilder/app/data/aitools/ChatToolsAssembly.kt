package com.dsbuilder.app.data.aitools

import org.koin.core.Koin

/** Собирает обработчики инструментов чата из use case графа DS. */
fun inProcessChatTools(koin: Koin): InProcessChatTools = InProcessChatTools(
    tools = designSystemChatTools(koin) + tokenChatTools(koin) + themeChatTools(koin) + componentChatTools(koin),
    draftCursor = koin.get(),
)
