package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.domain.TargetPlatform

/**
 * Выбор целевой платформы для команды: явный `--platform` побеждает; иначе платформа берётся
 * из `.sdds/config.json`, и только если она там ровно одна.
 *
 * Один и тот же выбор нужен командам генерации и документации, поэтому правило и его сообщения
 * живут здесь, а не в каждой фиче.
 */
public object PlatformResolver {
    /**
     * Выбирает платформу для команды.
     *
     * @param explicit платформа из `--platform`, если пользователь её задал.
     * @param configured платформы, объявленные в project config.
     */
    public fun resolve(
        explicit: TargetPlatform?,
        configured: List<TargetPlatform>,
    ): PlatformResolution {
        if (explicit != null) {
            return PlatformResolution.Resolved(explicit)
        }

        val distinct = configured.distinct()

        return when {
            distinct.size == 1 -> PlatformResolution.Resolved(distinct.single())
            distinct.isEmpty() -> PlatformResolution.Failed(
                "Target platform is not set. Pass --platform <${TargetPlatform.cliValues.joinToString("|")}> " +
                    "or record it once in .sdds/config.json as \"platforms\": [\"<platform>\"] " +
                    "(`dsbuilder init --platform <platform>` writes it for a new project).",
            )
            else -> PlatformResolution.Failed(
                "Project config declares several platforms (${distinct.joinToString { it.cliValue }}). " +
                    "Pass --platform to choose one.",
            )
        }
    }
}

/**
 * Результат выбора платформы.
 */
public sealed interface PlatformResolution {
    /**
     * Платформа выбрана.
     *
     * @property platform выбранная платформа.
     */
    public data class Resolved(
        public val platform: TargetPlatform,
    ) : PlatformResolution

    /**
     * Платформу выбрать нельзя: не задана или их несколько.
     *
     * @property message user-facing объяснение с указанием, как задать платформу.
     */
    public data class Failed(
        public val message: String,
    ) : PlatformResolution
}
