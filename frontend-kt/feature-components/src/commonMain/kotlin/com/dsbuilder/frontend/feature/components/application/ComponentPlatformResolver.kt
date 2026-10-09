package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.TargetPlatform

/**
 * Определяет платформу компонентов для `components push` и `components fetch`.
 *
 * Компонент в backend идентифицируется парой `(имя, платформа)`, поэтому без платформы запрос
 * неоднозначен, а подставлять её по умолчанию нельзя. Платформа берётся из `platforms`
 * `.sdds/config.json`: единственная используется как есть, при нескольких нужна явная опция.
 */
internal object ComponentPlatformResolver {
    /**
     * @param declared платформы проекта из `.sdds/config.json`.
     * @param override значение `--platform`; побеждает конфигурацию.
     */
    fun resolve(declared: List<TargetPlatform>, override: TargetPlatform?): ComponentPlatformResolution = when {
        override != null -> ComponentPlatformResolution.Resolved(override)
        declared.size == 1 -> ComponentPlatformResolution.Resolved(declared.single())
        declared.isEmpty() -> ComponentPlatformResolution.Failed(
            "Error: no platform is declared in the project config. Pass --platform " +
                "(${TargetPlatform.cliValues.joinToString(", ")}).",
        )
        else -> ComponentPlatformResolution.Failed(
            "Error: the project declares several platforms (${declared.joinToString(", ") { it.cliValue }}). " +
                "Choose one with --platform.",
        )
    }
}

internal sealed interface ComponentPlatformResolution {
    data class Resolved(val platform: TargetPlatform) : ComponentPlatformResolution

    data class Failed(val message: String) : ComponentPlatformResolution
}
