package com.dsbuilder.architecture

import com.lemonappdev.konsist.api.Konsist
import com.lemonappdev.konsist.api.architecture.Layer
import com.lemonappdev.konsist.api.architecture.KoArchitectureCreator.assertArchitecture
import kotlin.test.Test

class LayerArchitectureTest {
    @Test
    fun `слои backend не содержат новых обратных зависимостей сверх известных нарушений`() {
        // TODO(architecture): исправить перечисленные ниже зависимости и удалить исключения.
        // Пока список не пуст, тест служит корректным regression gate, но успешный результат
        // не означает, что backend-архитектура полностью соответствует правилам слоёв.
        val legacyArchitectureExceptions = setOf(
            "projects-service/feature-projects/src/main/kotlin/com/dsbuilder/projects/feature/projects/application/usecase/AccessKeyUseCases.kt",
            "documentation-service/feature-ingestion/src/main/kotlin/com/dsbuilder/documentation/ingestion/presentation/DocumentationBundleRoutes.kt",
        )
        val productionFiles = Konsist
            .scopeFromProduction()
            .files
            .filterNot { file -> legacyArchitectureExceptions.any(file.projectPath::endsWith) }

        productionFiles.assertArchitecture {
            val domain = Layer("Domain", "com.dsbuilder..domain..")
            val application = Layer("Application", "com.dsbuilder..application..")
            val data = Layer("Data", "com.dsbuilder..data..")
            val presentation = Layer("Presentation", "com.dsbuilder..presentation..")
            val di = Layer("DI", "com.dsbuilder..di..")

            domain.doesNotDependOn(application, data, presentation, di)
            application.doesNotDependOn(data, presentation, di)
            presentation.doesNotDependOn(data, di)
        }
    }
}
