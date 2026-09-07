package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.application.ClientRuntime

/**
 * Создает runtime-зависимости для текущей платформы.
 */
public expect fun defaultClientRuntime(): ClientRuntime
