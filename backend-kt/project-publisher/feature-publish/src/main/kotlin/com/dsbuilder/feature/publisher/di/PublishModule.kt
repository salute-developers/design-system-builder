package com.dsbuilder.feature.publisher.di

import com.dsbuilder.feature.publisher.application.TransactionManager
import com.dsbuilder.feature.publisher.application.port.JobDispatcher
import com.dsbuilder.feature.publisher.application.port.JobLocalSource
import com.dsbuilder.feature.publisher.application.port.PayloadFetcher
import com.dsbuilder.feature.publisher.application.usecase.*
import com.dsbuilder.feature.publisher.data.JobDispatcherImpl
import com.dsbuilder.feature.publisher.data.local.JobDatabaseSource
import com.dsbuilder.feature.publisher.data.local.db.*
import com.dsbuilder.feature.publisher.data.remote.PayloadFetcherImpl
import com.dsbuilder.feature.publisher.presentation.PublisherController
import com.dsbuilder.feature.publisher.presentation.PublisherControllerImpl
import io.ktor.server.application.*
import kotlinx.coroutines.launch
import org.jetbrains.exposed.v1.core.Table
import org.koin.dsl.module
import org.koin.ktor.ext.inject

object PublishModule {

    val db: Array<Table> = arrayOf(Jobs, JobArtifacts)

    val beans = module {
        single<TransactionManager> { JdbcTransactionManager(dbProvider = get()) }
        single<JobArtifactDao> { JobArtifactDaoImpl() }
        single<JobDao> { JobDaoImpl() }
        single<PayloadFetcher> { PayloadFetcherImpl() }
        single<JobLocalSource> {
            JobDatabaseSource(
                jobDao = get(),
                jobArtifactDao = get()
            )
        }

        single<JobDispatcher> {
            JobDispatcherImpl(
                jobLocalSource = get(),
                tx = get()
            )
        }

        single<CancelJobUseCase> { CancelJobUseCaseImpl(jobDispatcher = get()) }
        single<GetJobArtifactsUseCase> { GetJobArtifactsUseCaseImpl(jobLocalSource = get(), tx = get()) }
        single<GetJobsUseCase> { GetJobsUseCaseImpl(jobLocalSource = get(), tx = get()) }
        single<GetJobUseCase> { GetJobUseCaseImpl(jobLocalSource = get(), tx = get()) }
        single<ListenJobLogsUseCase> { ListenJobLogsUseCaseImpl(jobDispatcher = get()) }
        single<PublishJobUseCase> {
            PublishJobUseCaseImpl(
                jobLocalSource = get(),
                payloadFetcher = get(),
                jobDispatcher = get(),
                tx = get(),
            )
        }

        single<PublisherController> {
            PublisherControllerImpl(
                publishJob = get(),
                listenJobLogs = get(),
                getJob = get(),
                getJobs = get(),
                getJobArtifacts = get(),
                cancelJob = get()
            )
        }
    }

    fun start(application: Application) = application.run {
        val jobDispatcher by inject<JobDispatcher>()

        val job = launch {
            jobDispatcher.start()
        }

        monitor.subscribe(ApplicationStopping) {
            job.cancel()
        }
    }
}