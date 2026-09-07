package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.domain.TargetPlatform

/**
 * Порт платформенного инструмента.
 *
 * Команды `theme generate`, `components generate` и платформенный шаг `docs generate` не знают,
 * чем именно генерируется код: они берут делегат из [PlatformDelegateRegistry] по целевой платформе
 * и вызывают его. Реализация делегата собирает argv для внешнего инструмента (Swift CLI, Gradle)
 * и запускает его через `ProcessRunner`; ни presentation, ни use case'ы процессы не запускают.
 *
 * Добавить платформу = реализовать этот интерфейс в модуле `platform-<toolchain>` и
 * зарегистрировать реализацию в composition root клиента.
 */
public interface PlatformDelegate {
    /** Идентификатор toolchain'а, уникальный среди зарегистрированных делегатов. */
    public val toolchain: ToolchainId

    /** Целевые платформы, которые обслуживает делегат; одна платформа — ровно один делегат. */
    public val platforms: Set<TargetPlatform>

    /** Что делегат умеет; для остальных capability он обязан вернуть [DelegateResult.Unsupported]. */
    public val capabilities: Set<Capability>

    /**
     * Проверяет, что инструмент установлен и совместим, ничего не генерируя.
     *
     * @param workspace пути рабочей копии: для инструментов, живущих в проекте (Gradle), поиск идёт от неё.
     */
    public fun doctor(workspace: WorkspacePaths): ToolchainStatus

    /**
     * Запускает инструмент и ждёт завершения.
     *
     * Делегат не получает и не передаёт инструменту project API key.
     *
     * @param invocation что запустить и с какими путями.
     */
    public fun run(invocation: DelegateInvocation): DelegateResult
}
