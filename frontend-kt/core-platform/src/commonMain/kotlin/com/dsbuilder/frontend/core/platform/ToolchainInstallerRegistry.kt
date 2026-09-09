package com.dsbuilder.frontend.core.platform

/**
 * Реестр установщиков: один toolchain — не более одного установщика.
 *
 * Состав задаёт composition root клиента; use case знает только этот реестр.
 *
 * @param installers установщики в порядке регистрации.
 * @throws IllegalArgumentException если два установщика делят toolchain id.
 */
public class ToolchainInstallerRegistry(
    installers: List<ToolchainInstaller>,
) {
    /** Зарегистрированные установщики в порядке регистрации. */
    public val all: List<ToolchainInstaller> = installers.toList()

    private val byToolchain: Map<ToolchainId, ToolchainInstaller> = buildMap {
        all.forEach { installer ->
            require(put(installer.toolchain, installer) == null) {
                "Toolchain '${installer.toolchain}' has two installers."
            }
        }
    }

    /** Возвращает установщик toolchain'а либо `null`, если ставить его нечем. */
    public fun forToolchain(toolchain: ToolchainId): ToolchainInstaller? = byToolchain[toolchain]
}
