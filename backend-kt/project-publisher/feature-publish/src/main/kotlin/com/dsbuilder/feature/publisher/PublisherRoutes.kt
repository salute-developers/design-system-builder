package com.dsbuilder.feature.publisher

import com.dsbuilder.feature.publisher.presentation.*
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import org.koin.ktor.ext.inject

fun Route.publisherApi() {

    val publisherController: PublisherController by inject()

    route("/jobs") {
        get {
            val projectId = call.queryParameters["projectId"]?.toString()
            if (projectId == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@get
            }
            val limit = call.queryParameters["limit"]?.toIntOrNull() ?: 50
            val offset = call.queryParameters["offset"]?.toLongOrNull() ?: 0L
            publisherController.getJobs(projectId, limit, offset)
                .onSuccess { call.respond(it) }
                .onFailure { it.printStackTrace() }
                .onFailure { call.respond(HttpStatusCode.InternalServerError, it.message ?: "Error fetching jobs") }
        }

        get("{id}") {
            val jobId = call.pathParameters["id"]?.toString()
            if (jobId == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@get
            }
            publisherController.getJob(jobId)
                .onSuccess { call.respond(it) }
                .onFailure { it.printStackTrace() }
                .onFailure { call.respond(HttpStatusCode.InternalServerError, it.message ?: "Error fetching job") }
        }

        get("{id}/artifacts") {
            val jobId = call.pathParameters["id"]?.toString()
            if (jobId == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@get
            }
            publisherController.getJobArtifacts(jobId)
                .onSuccess { call.respond(it) }
                .onFailure { it.printStackTrace() }
                .onFailure { call.respond(HttpStatusCode.InternalServerError, it.message ?: "Error fetching job") }
        }

        post {
            val request = call.receive<PublishParamsDto>()
             publisherController.publishJob(request)
                .onSuccess { call.respond(it) }
                .onFailure { it.printStackTrace() }
                .onFailure { call.respond(HttpStatusCode.InternalServerError, it.message ?: "Error publishing job") }
        }

        post("{id}/cancel") {
            val jobId = call.pathParameters["id"]?.toString()
            if (jobId == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@post
            }
            publisherController.cancelJob(jobId)
                .onSuccess { call.respond(HttpStatusCode.OK) }
                .onFailure { it.printStackTrace() }
                .onFailure { call.respond(HttpStatusCode.InternalServerError, it.message ?: "Error cancelling job") }
        }

        webSocket("{id}/logs") {
            val jobId = call.parameters["id"]
                ?: return@webSocket close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "Job id is not specified"))

            publisherController
                .getJobLogs(jobId)
                .onEach { outgoing.send(JobLogsWsResponse(it).toFrameText()) }
                .launchIn(this)


            // Держим сессию пока клиент не завершит ее
            for (frame in incoming) {
                if (frame is Frame.Close) break
            }
        }
    }
}