package com.dsbuilder.frontend.core.platform

/**
 * Порт установки платформенного инструмента.
 *
 * Инструменты остаются самостоятельными артефактами: клиент не вшивает их в себя, а кладёт
 * опубликованный релиз туда, где его уже ищет locator делегата.
 */
public interface ToolchainInstaller {
    /** Toolchain, который ставит этот установщик. */
    public val toolchain: ToolchainId

    /**
     * Ставит инструмент и делает установленную версию текущей.
     *
     * Установка не читает и не меняет `.sdds` проекта и не требует инициализированного проекта.
     */
    public fun install(request: ToolchainInstallRequest): ToolchainInstallResult
}

/**
 * Что ставить.
 *
 * @property version тег релиза из `--version`; `null` — последний опубликованный.
 * @property archive путь или URL готового архива из `--from`; тогда релиз не разрешается.
 */
public data class ToolchainInstallRequest(
    public val version: String? = null,
    public val archive: String? = null,
)

/**
 * Результат установки.
 */
public sealed interface ToolchainInstallResult {
    /**
     * Инструмент установлен и стал текущим.
     *
     * @property version версия, которую поставили.
     * @property executable путь установленного инструмента.
     */
    public data class Installed(
        public val version: String,
        public val executable: String,
    ) : ToolchainInstallResult

    /**
     * Установка не удалась.
     *
     * @property message user-facing объяснение.
     */
    public data class Failed(
        public val message: String,
    ) : ToolchainInstallResult
}
