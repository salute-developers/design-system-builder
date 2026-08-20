package com.dsbuilder.feature.publisher.data.remote

import com.dsbuilder.feature.publisher.application.port.PayloadFetcher
import com.dsbuilder.feature.publisher.domain.entity.JobParams
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL
import java.util.UUID

internal class PayloadFetcherImpl: PayloadFetcher {

    override suspend fun fetch(jobId: UUID, params: JobParams) {
        withContext(Dispatchers.IO) {
            val themeUrl = "$BASE_URL/themes/${params.projectKey}/${params.version}.zip"
            val componentsUrl = "$BASE_URL/components/${params.projectKey}/${params.version}-rc.zip"
            val baseDir = File("/tmp/builds/$jobId/payloads/")
            val themeDir = File(baseDir, "theme")
            val componentsDir = File(baseDir, "components")

            themeDir.mkdirs()
            componentsDir.mkdirs()

            val themeZipFile = File(baseDir, "theme.zip")
            val componentsZipFile = File(baseDir, "components.zip")

            // Download theme.zip
            URL(themeUrl).openStream().use { input ->
                themeZipFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }

            // Download components.zip
            URL(componentsUrl).openStream().use { input ->
                componentsZipFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        }
    }

    private companion object {
        const val BASE_URL = "https://github.com/salute-developers/theme-converter/raw/refs/heads/main"
    }
}