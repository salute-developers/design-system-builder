package com.dsbuilder.feature.publisher.data.local.db

import com.dsbuilder.feature.publisher.domain.entity.JobParams
import com.dsbuilder.feature.publisher.domain.entity.JobProjectVersion
import com.dsbuilder.feature.publisher.domain.entity.JobStatus
import com.dsbuilder.feature.publisher.domain.entity.JobStatusCode
import com.dsbuilder.feature.publisher.domain.entity.JobTarget
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.select

import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/**
 * DAO-интерфейс для работы с заданиями публикации.
 * Предоставляет методы для создания, получения, обновления и выборки заданий.
 */
interface JobDao {

    /**
     * Создаёт новое задание публикации.
     *
     * @param projectId идентификатор проекта.
     * @param platform платформа, на которую выполняется публикация.
     * @return созданный объект [PublishJob].
     */
    fun create(
        params: JobParams,
    ): ResultRow

    /**
     * Возвращает задание по его идентификатору.
     *
     * @param id идентификатор задания.
     * @return объект [PublishJob], если найден, иначе `null`.
     */
    fun get(id: UUID): ResultRow?

    /**
     * Возвращает задание по его идентификатору.
     *
     * @param id идентификатор задания.
     * @return объект [PublishJob], если найден, иначе `null`.
     */
    fun get(projectId: UUID, version: JobProjectVersion, target: JobTarget): List<ResultRow>

    /**
     * Возвращает список заданий, отфильтрованных по проекту.
     *
     * @param projectId идентификатор проекта, если нужно ограничить выборку.
     * @param limit максимальное количество результатов (по умолчанию 50).
     * @param offset смещение для пагинации (по умолчанию 0).
     * @return список объектов [PublishJob].
     */
    fun getAll(projectId: UUID, limit: Int = 50, offset: Long = 0): List<ResultRow>

    fun getAll(statuses: Set<JobStatusCode>): List<ResultRow>

    /**
     * Обновляет запись задания в базе данных.
     *
     * @param job объект [PublishJob], содержащий обновлённые данные.
     * @return обновлённый объект [PublishJob], если запись найдена, иначе `null`.
     */
    fun update(job: PublishJob): ResultRow?

    fun updateStatus(jobId: UUID, status: JobStatus): ResultRow?

    fun updateStatus(jobIds: Set<UUID>, status: JobStatus): Int
}

/**
 * Реализация [JobDao]
 */
internal class JobDaoImpl() : JobDao {

    override fun create(params: JobParams): ResultRow {
        return Jobs.insertReturning(Jobs.columns) {
            it[projectId] = params.projectId
            it[target] = params.target.name
            it[container] = null
            it[createdAt] = Instant.now()
            it[updatedAt] = null
            it[startedAt] = null
            it[finishedAt] = null
            it[status] = JobStatusCode.QUEUED.name
            it[exitCode] = null
            it[errorMessage] = null
            it[versionMajor] = params.version.major
            it[versionMinor] = params.version.minor
            it[versionPatch] = params.version.patch
            it[projectName] = params.name
        }.single()
    }

    override fun get(id: UUID): ResultRow? {
        return Jobs.select(Jobs.columns).where { Jobs.id eq id }.singleOrNull()
    }

    override fun get(
        projectId: UUID,
        version: JobProjectVersion,
        target: JobTarget
    ): List<ResultRow> {
        return Jobs.select(Jobs.columns)
            .where {
                (Jobs.projectId eq projectId) and
                        (Jobs.versionMajor eq version.major) and
                        (Jobs.versionMinor eq version.minor) and
                        (Jobs.versionPatch eq version.patch) and
                        (Jobs.target eq target.name)
            }
            .toList()
    }

    override fun getAll(projectId: UUID, limit: Int, offset: Long): List<ResultRow> {
        return Jobs.select(Jobs.columns)
            .where { Jobs.projectId eq projectId }
            .orderBy(Jobs.createdAt to SortOrder.DESC)
            .limit(limit)
            .offset(offset)
            .toList()
    }

    override fun getAll(statuses: Set<JobStatusCode>): List<ResultRow> {
        return Jobs.select(Jobs.columns)
            .orderBy(Jobs.createdAt to SortOrder.ASC)
            .where { Jobs.status inList statuses.map { it.name } }
            .toList()
    }


    override fun update(job: PublishJob): ResultRow? {
        val now = Instant.now()

        return Jobs.updateReturning(where = { Jobs.id eq job.id }) {
            it[projectId] = job.params.projectId
            it[target] = job.params.target.name
            it[container] = job.container
            it[startedAt] = job.metrics.startedAt
            it[finishedAt] = job.metrics.finishedAt
            it[status] = job.status.statusCode.name
            it[exitCode] = job.status.exitCode
            it[errorMessage] = (job.status as? JobStatus.Failed)?.errorMessage
            it[updatedAt] = now
            it[startedAt] = job.metrics.startedAt
            it[finishedAt] = job.metrics.finishedAt
            it[status] = job.status.statusCode.name
            it[versionMajor] = job.params.version.major
            it[versionMinor] = job.params.version.minor
            it[versionPatch] = job.params.version.patch
            it[projectName] = job.params.name
        }.singleOrNull()
    }

    override fun updateStatus(
        jobId: UUID,
        status: JobStatus
    ): ResultRow? {
        val now = Instant.now()
        return Jobs.updateReturning(where = { Jobs.id eq jobId }) {
            it[updatedAt] = now
            it[Jobs.status] = status.statusCode.name
            when (status) {
                JobStatus.Running -> {
                    it[startedAt] = now
                }

                is JobStatus.Succeeded,
                JobStatus.Canceled,
                is JobStatus.Failed -> {
                    it[finishedAt] = now
                }

                else -> Unit
            }
        }.singleOrNull()
    }

    override fun updateStatus(
        jobIds: Set<UUID>,
        status: JobStatus
    ): Int {
        val now = Instant.now()
        return Jobs.update(where = { Jobs.id inList jobIds.map { it } }) {
            it[updatedAt] = now
            it[Jobs.status] = status.statusCode.name
            when (status) {
                JobStatus.Running -> {
                    it[startedAt] = now
                }

                is JobStatus.Succeeded,
                JobStatus.Canceled,
                is JobStatus.Failed -> {
                    it[finishedAt] = now
                }

                else -> Unit
            }
        }
    }
}