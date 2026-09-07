package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.domain.TargetPlatform

/**
 * Реестр платформенных делегатов: одна целевая платформа — ровно один делегат.
 *
 * Состав реестра задаёт composition root клиента; ни один use case не знает конкретных делегатов.
 *
 * @param delegates делегаты в порядке регистрации.
 * @throws IllegalArgumentException если два делегата делят toolchain id или претендуют на одну платформу.
 */
public class PlatformDelegateRegistry(
    delegates: List<PlatformDelegate>,
) {
    /** Зарегистрированные делегаты в порядке регистрации. */
    public val all: List<PlatformDelegate> = delegates.toList()

    private val byPlatform: Map<TargetPlatform, PlatformDelegate> = buildMap {
        val toolchains = mutableSetOf<ToolchainId>()
        all.forEach { delegate ->
            require(toolchains.add(delegate.toolchain)) {
                "Toolchain '${delegate.toolchain}' is registered twice."
            }
            delegate.platforms.forEach { platform ->
                val claimed = get(platform)
                require(claimed == null) {
                    "Platform '${platform.cliValue}' is claimed by both " +
                        "'${claimed?.toolchain}' and '${delegate.toolchain}'."
                }
                put(platform, delegate)
            }
        }
    }

    /**
     * Возвращает делегат, обслуживающий платформу, либо `null`, если платформа никем не поддержана.
     */
    public fun forPlatform(platform: TargetPlatform): PlatformDelegate? = byPlatform[platform]
}
