package com.dsbuilder.feature.publisher.application.port

import com.dsbuilder.feature.publisher.domain.entity.JobArtifact
import com.dsbuilder.feature.publisher.domain.entity.JobParams
import com.dsbuilder.feature.publisher.domain.entity.JobProjectVersion
import com.dsbuilder.feature.publisher.domain.entity.JobStatus
import com.dsbuilder.feature.publisher.domain.entity.JobStatusCode
import com.dsbuilder.feature.publisher.domain.entity.JobTarget
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import java.util.UUID

internal interface JobLocalSource {

    /**
     * Возвращает задание по его идентификатору.
     *
     * @param id идентификатор задания.
     * @return объект [PublishJob], если найден, иначе `null`.
     */
    fun get(id: UUID): PublishJob?

    fun get(projectId: UUID, version: JobProjectVersion, target: JobTarget): List<PublishJob>

    /**
     * Возвращает список заданий для указанного проекта.
     *
     * @param projectId идентификатор проекта.
     * @param limit максимальное количество возвращаемых записей (по умолчанию 50).
     * @param offset смещение для пагинации (по умолчанию 0).
     * @return список объектов [PublishJob].
     */
    fun getAll(projectId: UUID, limit: Int = 50, offset: Long = 0): List<PublishJob>

    fun getAll(statuses: Set<JobStatusCode>): List<PublishJob>

    /**
     * Создаёт новое задание публикации.
     *
     * @param params параметры задания.
     * @return созданный объект [PublishJob].
     */
    fun create(params: JobParams): PublishJob

    /**
     * Обновляет существующее задание публикации.
     *
     * @param job объект [PublishJob] с обновлёнными данными.
     * @return обновлённый объект [PublishJob].
     */
    fun update(job: PublishJob): PublishJob?

    /**
     * Обновляет статус у задания публикации.
     *
     * @param jobId объект [PublishJob] с обновлёнными данными.
     * @param status объект [PublishJob] с обновлёнными данными.
     * @return обновлённый объект [PublishJob].
     */
    fun updateStatus(jobId: UUID, status: JobStatus): PublishJob?

    fun updateStatus(jobIds: Set<UUID>, status: JobStatus): Boolean

    fun getArtifacts(jobId: UUID, limit: Int = 50, offset: Long = 0): List<JobArtifact>
}