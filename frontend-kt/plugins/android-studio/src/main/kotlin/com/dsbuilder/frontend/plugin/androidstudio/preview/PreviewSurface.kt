package com.dsbuilder.frontend.plugin.androidstudio.preview

/** backgroundDefaultPrimary из темы plasma-android integration-core/sandbox-compose. Формат RGBA. */
internal fun previewSurfaceBackground(mode: String): String =
    if (mode == "dark") "#080808FF" else "#F9F9F9FF"
