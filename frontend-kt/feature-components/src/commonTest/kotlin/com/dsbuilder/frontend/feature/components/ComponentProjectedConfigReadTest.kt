package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ContextSource
import com.dsbuilder.frontend.core.application.ContextSourceResult
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentConfigView
import com.dsbuilder.frontend.feature.components.application.ComponentGetReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentListReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentProjectedConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentReadRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadRuntime
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class ComponentProjectedConfigReadTest {
    @Test
    fun configAndTokenCatalogUseOneResolvedRuntime() = runTest {
        var resolutions = 0
        val contexts = listOf("first", "second")
        val contextResolver = ContextResolver(
            listOf(
                ContextSource {
                    ContextSourceResult.Found(
                        ProjectContext(
                            ProjectId(contexts[resolutions++]),
                            DesignSystemId("ds"),
                            CredentialEnvName("KEY"),
                            "/workspace/.sdds/config.json",
                        ),
                    )
                },
            ),
        )
        val observed = mutableListOf<ComponentReadRuntime>()
        val remote = object : ComponentReadRemoteSource {
            override suspend fun list(
                runtime: ComponentReadRuntime,
                command: ComponentListReadCommand,
            ): ComponentReadResult = error("Unexpected list")

            override suspend fun get(
                runtime: ComponentReadRuntime,
                command: ComponentGetReadCommand,
            ): ComponentReadResult = error("Unexpected get")

            override suspend fun config(
                runtime: ComponentReadRuntime,
                command: ComponentConfigReadCommand,
            ): ComponentReadResult {
                observed += runtime
                return success(
                    """
                    {
                      "source":"api",
                      "data":{
                        "meta":{},
                        "components":[{
                          "componentName":"button",
                          "styleName":"basic",
                          "config":{"variations":[{
                            "id":"size",
                            "values":[{"name":"small","properties":{
                              "shape":{"type":"shape","value":"round.m"}
                            }}]
                          }]}
                        }]
                      }
                    }
                    """.trimIndent(),
                )
            }

            override suspend fun styles(
                runtime: ComponentReadRuntime,
                command: ComponentGetReadCommand,
            ): ComponentReadResult = error("Unexpected styles")

            override suspend fun variations(
                runtime: ComponentReadRuntime,
                command: ComponentGetReadCommand,
            ): ComponentReadResult = error("Unexpected variations")

            override suspend fun tokens(runtime: ComponentReadRuntime): ComponentReadResult {
                observed += runtime
                return success("""{"source":"api","data":[{"name":"round.m","type":"shape"}]}""")
            }
        }
        val useCases = ComponentReadUseCases(
            contextResolver,
            ApiUrlResolver(
                object : EnvironmentReader {
                    override fun get(name: String): String? = null
                },
            ),
            object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult = CredentialResult.Selected(
                    BackendCredential.ProjectKey("key"),
                    BackendCredentialType.PROJECT_KEY,
                )
            },
            remote,
        )

        val result = useCases.projectedConfig(
            ComponentProjectedConfigReadCommand(
                ComponentConfigReadCommand("button", null),
                mapOf("size" to "small"),
                ComponentConfigView.TOKEN_REFERENCES,
            ),
        )

        assertEquals(1, resolutions)
        assertEquals(listOf("first", "first"), observed.map { it.context.projectId.value })
        val data = assertIs<ComponentReadResult.Success>(result).value.jsonObject.getValue("data").jsonObject
        val values = data.getValue("components").jsonArray.single().jsonObject
            .getValue("config").jsonObject.getValue("variations").jsonArray.single().jsonObject
            .getValue("values").jsonArray
        assertEquals(1, values.size)
    }

    private fun success(body: String): ComponentReadResult.Success = ComponentReadResult.Success(
        Json.parseToJsonElement(body),
    )
}
