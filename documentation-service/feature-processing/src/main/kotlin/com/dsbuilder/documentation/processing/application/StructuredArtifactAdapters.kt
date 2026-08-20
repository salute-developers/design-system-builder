package com.dsbuilder.documentation.processing.application

import com.dsbuilder.documentation.publication.domain.CodeBinding
import com.dsbuilder.documentation.publication.domain.ProcessingDiagnostic
import com.dsbuilder.documentation.publication.domain.StructuredArtifact
import com.dsbuilder.documentation.publication.domain.StructuredArtifactType
import com.dsbuilder.documentation.publication.domain.StructuredLookupTerm

/** Ключ выбора structured artifact adapter. */
data class StructuredAdapterKey(
    /** Каноническая платформа. */
    val platform: String,
    /** Тип артефакта. */
    val artifactType: StructuredArtifactType,
    /** Versioned format. */
    val format: String,
)

/** Успешный результат адаптации одного source artifact. */
data class StructuredAdapterResult(
    /** Canonical bindings. */
    val bindings: List<CodeBinding>,
    /** Lookup terms всех bindings. */
    val lookupTerms: List<StructuredLookupTerm>,
)

/** Adapter versioned structured artifact. */
interface StructuredArtifactAdapter {
    /** Поддерживаемый tuple platform/type/format. */
    val key: StructuredAdapterKey

    /** Строго разбирает весь artifact без частичного результата. */
    fun adapt(
        artifact: StructuredArtifact,
        sourceJson: String,
    ): StructuredAdapterResult
}

/** Registry строгого выбора structured artifact adapter. */
class StructuredArtifactAdapterRegistry(
    adapters: Collection<StructuredArtifactAdapter>,
) {
    private val adaptersByKey = adapters.associateBy(StructuredArtifactAdapter::key)

    /** Находит adapter либо возвращает blocking diagnostic. */
    fun resolve(
        jobId: String,
        platform: String,
        artifactType: StructuredArtifactType,
        format: String?,
    ): AdapterResolution {
        if (format == null) {
            return AdapterResolution.Unsupported(
                ProcessingDiagnostic(
                    id = "$jobId:missing-format:${artifactType.name}",
                    jobId = jobId,
                    level = com.dsbuilder.documentation.publication.domain.DiagnosticLevel.ERROR,
                    code = "MISSING_ARTIFACT_FORMAT",
                    message = "Structured artifact format is required",
                    artifactType = artifactType.name,
                ),
            )
        }
        val key = StructuredAdapterKey(platform, artifactType, format)
        return adaptersByKey[key]?.let(AdapterResolution::Supported)
            ?: AdapterResolution.Unsupported(
                ProcessingDiagnostic(
                    id = "$jobId:unsupported-format:${artifactType.name}:$format",
                    jobId = jobId,
                    level = com.dsbuilder.documentation.publication.domain.DiagnosticLevel.ERROR,
                    code = "UNSUPPORTED_ARTIFACT_FORMAT",
                    message = "Structured artifact format is not supported",
                    artifactType = artifactType.name,
                    details = "{\"platform\":\"$platform\",\"format\":\"$format\"}",
                ),
            )
    }

    /** Строго адаптирует artifact и преобразует schema error в blocking diagnostic. */
    fun adapt(
        jobId: String,
        artifact: StructuredArtifact,
        platform: String,
        sourceJson: String,
    ): AdapterExecution {
        val resolution = resolve(jobId, platform, artifact.type, artifact.format)
        if (resolution is AdapterResolution.Unsupported) {
            return AdapterExecution.Failed(resolution.diagnostic)
        }
        return try {
            AdapterExecution.Completed(
                (resolution as AdapterResolution.Supported).adapter.adapt(artifact, sourceJson),
            )
        } catch (_: IllegalArgumentException) {
            AdapterExecution.Failed(invalidArtifactDiagnostic(jobId, artifact))
        } catch (_: kotlinx.serialization.SerializationException) {
            AdapterExecution.Failed(invalidArtifactDiagnostic(jobId, artifact))
        }
    }

    private fun invalidArtifactDiagnostic(
        jobId: String,
        artifact: StructuredArtifact,
    ) = ProcessingDiagnostic(
        id = "$jobId:invalid-artifact:${artifact.id}",
        jobId = jobId,
        level = com.dsbuilder.documentation.publication.domain.DiagnosticLevel.ERROR,
        code = "INVALID_STRUCTURED_ARTIFACT",
        message = "Structured artifact does not match the declared format",
        artifactType = artifact.type.name,
    )
}

/** Результат выбора adapter. */
sealed interface AdapterResolution {
    /** Adapter найден. */
    data class Supported(
        /** Выбранный adapter. */
        val adapter: StructuredArtifactAdapter,
    ) : AdapterResolution

    /** Adapter не найден из-за contract error. */
    data class Unsupported(
        /** Blocking diagnostic. */
        val diagnostic: ProcessingDiagnostic,
    ) : AdapterResolution
}

/** Результат строгого разбора structured artifact. */
sealed interface AdapterExecution {
    /** Artifact полностью преобразован. */
    data class Completed(
        /** Полный результат без partial bindings. */
        val result: StructuredAdapterResult,
    ) : AdapterExecution

    /** Artifact полностью отклонён. */
    data class Failed(
        /** Blocking diagnostic. */
        val diagnostic: ProcessingDiagnostic,
    ) : AdapterExecution
}
