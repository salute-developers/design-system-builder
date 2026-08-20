package com.dsbuilder.feature.publisher.data.local

import com.dsbuilder.feature.publisher.application.port.JobLocalSource
import com.dsbuilder.feature.publisher.data.local.db.JobArtifactDao
import com.dsbuilder.feature.publisher.data.local.db.JobDao
import com.dsbuilder.feature.publisher.data.local.db.toJobArtifact
import com.dsbuilder.feature.publisher.data.local.db.toPublishJob
import com.dsbuilder.feature.publisher.domain.entity.JobArtifact
import com.dsbuilder.feature.publisher.domain.entity.JobParams
import com.dsbuilder.feature.publisher.domain.entity.JobProjectVersion
import com.dsbuilder.feature.publisher.domain.entity.JobStatus
import com.dsbuilder.feature.publisher.domain.entity.JobStatusCode
import com.dsbuilder.feature.publisher.domain.entity.JobTarget
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import java.util.UUID

internal class JobDatabaseSource(
    private val jobDao: JobDao,
    private val jobArtifactDao: JobArtifactDao,
) : JobLocalSource {

    override fun get(id: UUID): PublishJob? =
        jobDao.get(id)?.toPublishJob()

    override fun get(
        projectId: UUID,
        version: JobProjectVersion,
        target: JobTarget
    ): List<PublishJob> =
        jobDao.get(
            projectId,
            version,
            target
        ).map { it.toPublishJob() }

    override fun getAll(
        projectId: UUID,
        limit: Int,
        offset: Long
    ): List<PublishJob> =
        jobDao.getAll(projectId, limit, offset).map { it.toPublishJob() }

    override fun getAll(statuses: Set<JobStatusCode>): List<PublishJob> =
        jobDao.getAll(statuses).map { it.toPublishJob() }

    override fun create(params: JobParams): PublishJob =
        jobDao.create(params).toPublishJob()

    override fun update(job: PublishJob): PublishJob? =
        jobDao.update(job)?.toPublishJob()

    override fun updateStatus(
        jobId: UUID,
        status: JobStatus
    ): PublishJob? {
        val updatedJob = jobDao.updateStatus(jobId, status)
        val artifacts = if (status is JobStatus.Succeeded) {
            jobArtifactDao.create(jobId, status.artifacts)
                .map { it.toJobArtifact() }
        } else {
            emptyList()
        }
        return updatedJob?.toPublishJob(artifacts)
    }

    override fun updateStatus(jobIds: Set<UUID>, status: JobStatus): Boolean =
        jobDao.updateStatus(jobIds, status) > 0


    override fun getArtifacts(
        jobId: UUID,
        limit: Int,
        offset: Long
    ): List<JobArtifact> =
        jobArtifactDao.getAll(jobId, limit, offset)
            .map { it.toJobArtifact() }

}