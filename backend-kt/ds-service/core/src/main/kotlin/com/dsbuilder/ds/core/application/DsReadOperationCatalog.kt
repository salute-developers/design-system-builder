package com.dsbuilder.ds.core.application

/** Общий каталог публично читаемых операций без зависимости от HTTP и YAML. */
class DsReadOperationCatalog(
    operations: List<DsReadOperation>,
    sharedGetPaths: Set<String> = emptySet(),
) {
    /** Неизменяемый снимок описателей, общий для шлюза и транзакционного входа. */
    val operations: List<DsReadOperation> = operations.toList()

    /** Только статические пути независимых GET; параметризованный ресурс требует границы ДС. */
    val sharedGetPaths: Set<String> = sharedGetPaths.toSet()

    private val routePatterns = this.operations.associate { operation ->
        val pattern = operation.path.split('/').joinToString("/") { segment ->
            when {
                segment == "{designSystemId}" -> "[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
                segment.matches(Regex("\\{[^/]+}")) -> "[^/]+"
                else -> Regex.escape(segment)
            }
        }
        operation.path to Regex(pattern)
    }

    init {
        require(this.operations.distinctBy { it.method to it.path }.size == this.operations.size) {
            "Duplicate public read declaration"
        }
        require(
            this.sharedGetPaths.all { path ->
                path.startsWith("/api/design-systems/catalog/") &&
                    path.none { it in "{}?" }
            },
        ) {
            "Shared public resource must have a static catalog path"
        }
        require(
            this.operations.all { operation ->
                when (operation.kind) {
                    DsPublicReadKind.HISTORY ->
                        operation.method == "GET" &&
                            operation.path == "/api/design-systems/{designSystemId}/versions"
                    DsPublicReadKind.VERSION_BY_ID ->
                        operation.method == "GET" &&
                            operation.path == "/api/design-systems/{designSystemId}/versions/{id}"
                    DsPublicReadKind.BOUNDARY ->
                        !operation.path.startsWith("/api/design-systems/{designSystemId}/versions")
                }
            },
        ) {
            "Public read kind does not match its resource boundary"
        }

        require(
            operations.all { operation ->
                val exportOperation = operation.path.substringAfterLast("/component-config/")
                val readOnlyPost = operation.method == "POST" && exportOperation in
                    setOf("export", "web-adapter")
                (operation.method == "GET" || readOnlyPost) && operation.permission.endsWith(":read") &&
                    "/{designSystemId}" in operation.path && "/catalog/" !in operation.path
            },
        ) { "Invalid public read declaration" }
    }

    /** Сопоставляет только полный канонический путь и метод. */
    fun find(method: String, path: String): DsReadOperation? = operations.firstOrNull { operation ->
        operation.method == method && routePatterns.getValue(operation.path).matches(path)
    }
}
