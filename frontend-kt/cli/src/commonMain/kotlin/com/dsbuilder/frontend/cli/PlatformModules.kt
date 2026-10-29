package com.dsbuilder.frontend.cli

import org.koin.core.module.Module

/** Модули доступных на текущей ОС платформенных инструментов. */
internal expect fun platformModules(): List<Module>
