package com.dsbuilder.frontend.architecture

import com.lemonappdev.konsist.api.Konsist
import com.lemonappdev.konsist.api.architecture.Layer
import com.lemonappdev.konsist.api.architecture.KoArchitectureCreator.assertArchitecture
import kotlin.test.Test

class LayerArchitectureTest {
    @Test
    fun `слои frontend не содержат обратных зависимостей`() {
        Konsist
            .scopeFromProduction()
            .assertArchitecture {
                val domain = Layer("Domain", "com.dsbuilder.frontend..domain..")
                val application = Layer("Application", "com.dsbuilder.frontend..application..")
                val data = Layer("Data", "com.dsbuilder.frontend..data..")
                val presentation = Layer("Presentation", "com.dsbuilder.frontend..presentation..")
                val di = Layer("DI", "com.dsbuilder.frontend..di..")

                domain.doesNotDependOn(application, data, presentation, di)
                application.doesNotDependOn(data, presentation, di)
                presentation.doesNotDependOn(data, di)
            }
    }
}
