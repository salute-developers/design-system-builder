package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.domain.TargetPlatform

/**
 * Делегат в памяти: объявляет платформы и capability, записывает вызовы и отдаёт заданный результат.
 *
 * Оркестрация проверяется на выборе делегата и обработке результата, а не на запуске инструмента.
 */
internal class FakePlatformDelegate(
    override val toolchain: ToolchainId,
    override val platforms: Set<TargetPlatform>,
    override val capabilities: Set<Capability> = Capability.entries.toSet(),
    private val status: ToolchainStatus = ToolchainStatus.Ready(executable = "/fake/tool", version = "1.0.0"),
    private val result: (DelegateInvocation) -> DelegateResult = { DelegateResult.Completed(summary = "done") },
) : PlatformDelegate {
    /** Вызовы `run` в порядке поступления. */
    val invocations: MutableList<DelegateInvocation> = mutableListOf()

    /** Вызовы `doctor` в порядке поступления. */
    val doctorCalls: MutableList<WorkspacePaths> = mutableListOf()

    override fun doctor(workspace: WorkspacePaths): ToolchainStatus {
        doctorCalls += workspace
        return status
    }

    override fun run(invocation: DelegateInvocation): DelegateResult {
        invocations += invocation
        return result(invocation)
    }
}
