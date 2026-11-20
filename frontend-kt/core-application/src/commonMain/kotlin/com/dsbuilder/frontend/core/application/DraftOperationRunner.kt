package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.network.HttpMutationResult

/** Параметры повторяемой записи выбранного черновика. */
public data class DraftEditOptions(
    /** Исходный ключ команды. */
    public val idempotencyKey: String,
    /** Явный draft либо версия контекста. */
    public val version: String? = null,
    /** Базовая предметная редакция. */
    public val baseRevision: Long? = null,
)

/** Результат операции редактора с однократно разрешённым контекстом. */
public sealed interface DraftOperationResult {
    /** Ответ предметного адаптера. */
    public data class Executed(
        /** HTTP-ответ либо неопределённый исход. */
        public val response: HttpMutationResult,
        /** Проект из разрешённого контекста. */
        public val projectId: String,
        /** Дизайн-система из разрешённого контекста. */
        public val designSystemId: String,
        /** Исходный ключ мутации, отсутствует у чтений. */
        public val idempotencyKey: String?,
    ) : DraftOperationResult

    /** Отказ до предметной операции. */
    public data class Failed(
        /** Стабильная категория ошибки. */
        public val code: String,
        /** Безопасное описание. */
        public val message: String,
    ) : DraftOperationResult
}

/** Общая политика выбора runtime и черновика для редакторов независимых фич. */
public class DraftOperationRunner(private val resolver: RuntimeRequestResolver) {
    /** Проверяет параметры записи и разрешает runtime ровно один раз. */
    public suspend fun mutate(
        options: DraftEditOptions,
        request: RuntimeRequest,
        operation: suspend (RuntimeResolution.Resolved) -> HttpMutationResult,
    ): DraftOperationResult {
        if (options.idempotencyKey.isBlank() || options.baseRevision?.let { it < 0 } == true) {
            return DraftOperationResult.Failed("VALIDATION_FAILED", "A key and non-negative revision are required.")
        }
        return execute(options.version, options.idempotencyKey, request, operation)
    }

    /** Разрешает исходное чтение редактора только для черновика. */
    public suspend fun read(
        version: String?,
        request: RuntimeRequest,
        operation: suspend (RuntimeResolution.Resolved) -> HttpMutationResult,
    ): DraftOperationResult = execute(version, null, request, operation)

    private suspend fun execute(
        version: String?,
        key: String?,
        request: RuntimeRequest,
        operation: suspend (RuntimeResolution.Resolved) -> HttpMutationResult,
    ): DraftOperationResult = when (val runtime = resolver.resolve(request)) {
        is RuntimeResolution.Failed -> DraftOperationResult.Failed(runtime.code.name, runtime.message)
        is RuntimeResolution.Resolved -> {
            val effectiveVersion = version ?: runtime.context.selectedVersion ?: "draft"
            if (effectiveVersion != "draft") {
                DraftOperationResult.Failed("READ_ONLY_VERSION", "Editor operations require draft.")
            } else {
                DraftOperationResult.Executed(
                    operation(runtime),
                    runtime.context.projectId.value,
                    runtime.context.designSystemId.value,
                    key,
                )
            }
        }
    }
}
