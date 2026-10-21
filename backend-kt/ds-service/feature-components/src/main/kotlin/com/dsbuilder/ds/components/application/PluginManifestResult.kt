package com.dsbuilder.ds.components.application

/** Результат разбора manifest. */
sealed interface PluginManifestResult {
    /** Manifest корректен и согласован с архивом. */
    data class Valid(
        /** Разобранный manifest. */
        val manifest: PluginManifest,
    ) : PluginManifestResult

    /** Manifest не принят. */
    data class Invalid(
        /** Стабильный код причины. */
        val code: String,
        /** Описание для пользователя. */
        val message: String,
    ) : PluginManifestResult
}
