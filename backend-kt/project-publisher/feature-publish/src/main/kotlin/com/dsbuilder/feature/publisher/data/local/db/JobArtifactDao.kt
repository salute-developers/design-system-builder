package com.dsbuilder.feature.publisher.data.local.db

import com.dsbuilder.feature.publisher.domain.entity.ArtifactType
import com.dsbuilder.feature.publisher.domain.entity.JobArtifact
import com.dsbuilder.feature.publisher.domain.entity.JobArtifactLink
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.*

/**
 * Интерфейс для работы с артефактами заданий в базе данных.
 *
 * Предоставляет методы для создания, получения, обновления и получения списка артефактов,
 * связанных с определёнными заданиями и проектами.
 */
internal interface JobArtifactDao {

    /**
     * Создаёт новый артефакт задания.
     *
     * @param jobId UUID задания, к которому относится артефакт.
     * @param uri URI артефакта.
     * @param type Тип артефакта.
     * @return Созданный объект [JobArtifact].
     */
    fun create(
        jobId: UUID,
        uri: String,
        type: ArtifactType,
    ): ResultRow

    /**
     * Создаёт новый артефакт задания.
     *
     * @param jobId UUID задания, к которому относится артефакт.
     * @param uri URI артефакта.
     * @param type Тип артефакта.
     * @return Созданный объект [JobArtifact].
     */
    fun create(
        jobId: UUID,
        artifactLink: List<JobArtifactLink>
    ): List<ResultRow>


    /**
     * Получает артефакт по его уникальному идентификатору.
     *
     * @param id UUID артефакта.
     * @return Объект [JobArtifact] или null, если артефакт не найден.
     */
    fun get(id: UUID): ResultRow?

    /**
     * Получает список артефактов для конкретного задания.
     *
     * @param jobId Опциональный UUID задания.
     * @param limit Максимальное количество возвращаемых артефактов.
     * @param offset Смещение для пагинации.
     * @return Список артефактов [JobArtifact].
     */
    fun getAll(jobId: UUID, limit: Int = 50, offset: Long = 0): List<ResultRow>

    /**
     * Обновляет существующий артефакт.
     *
     * @param artifact Объект артефакта с обновлёнными данными.
     * @return Обновлённый объект [JobArtifact] или null, если артефакт не найден.
     */
    fun update(artifact: JobArtifact): ResultRow?
}

/**
 * Реализация интерфейса [JobArtifactDao] с использованием базы данных R2DBC и Exposed.
 *
 * Выполняет операции создания, получения, обновления и получения списка артефактов
 * с помощью транзакций и SQL-запросов.
 *
 */
internal class JobArtifactDaoImpl() : JobArtifactDao {

    override fun create(jobId: UUID, uri: String, type: ArtifactType): ResultRow {
        return JobArtifacts.insertReturning {
            it[JobArtifacts.jobId] = EntityID(jobId, Jobs)
            it[JobArtifacts.uri] = uri
            it[JobArtifacts.type] = type.name
            it[createdAt] = Instant.now()
        }.single()
    }

    override fun create(jobId: UUID, artifacts: List<JobArtifactLink>): List<ResultRow> {
        return JobArtifacts.batchInsert(artifacts) {
            this[JobArtifacts.jobId] = EntityID(jobId, Jobs)
            this[JobArtifacts.uri] = it.uri
            this[JobArtifacts.type] = it.type.name
            this[JobArtifacts.createdAt] = Instant.now()
        }
    }

    override fun get(id: UUID): ResultRow? {
        return JobArtifacts
            .select(JobArtifacts.columns)
            .where { JobArtifacts.id eq id }
            .singleOrNull()
    }

    override fun getAll(jobId: UUID, limit: Int, offset: Long): List<ResultRow> {
        return (JobArtifacts innerJoin Jobs)
            .select(JobArtifacts.columns)
            .where { JobArtifacts.jobId eq jobId }
            .withDistinct()
            .orderBy(JobArtifacts.createdAt to SortOrder.DESC)
            .limit(limit)
            .offset(offset)
            .toList()
    }

    override fun update(artifact: JobArtifact): ResultRow? {
        return JobArtifacts.updateReturning(
            where = { JobArtifacts.id eq artifact.id }
        ) {
            it[type] = artifact.type.name
            it[uri] = artifact.uri
        }.singleOrNull()
    }
}