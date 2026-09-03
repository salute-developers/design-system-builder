package com.dsbuilder.frontend.cli.feature.components

import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackageMetaEntry
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackageWritePlan
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackageWritePlanBuilder
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackageWritePlanResult
import com.dsbuilder.frontend.cli.feature.components.domain.ExistingComponentPackage
import com.dsbuilder.frontend.cli.feature.components.domain.RenderedComponentConfig
import com.dsbuilder.frontend.cli.feature.components.domain.codec.NativeConfig
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * Тесты построителя плана записи.
 *
 * Построитель — вся политика записи: имя файла, переиспользование имён, коллизии, порядок
 * и вычисление несвязанных файлов. К файловой системе он не обращается, поэтому тесты
 * работают на доменных моделях и ничего не создают на диске.
 */
class ComponentPackageWritePlanBuilderTest {

    private val builder = ComponentPackageWritePlanBuilder()

    private fun config(componentName: String, styleName: String) =
        RenderedComponentConfig(componentName, styleName, NativeConfig())

    private fun planOf(
        configurations: List<RenderedComponentConfig>,
        existing: ExistingComponentPackage = ExistingComponentPackage(),
    ): ComponentPackageWritePlan =
        when (val result = builder.build("sdds_serv", "0.6.0-rc", configurations, existing)) {
            is ComponentPackageWritePlanResult.Built -> result.value
            is ComponentPackageWritePlanResult.Failed -> fail("построитель отказал — ${result.message}")
        }

    @Test
    fun buildsFileNameFromStyleName() {
        val plan = planOf(
            listOf(
                config("badge", "badge-clear"),
                config("avatar", "avatar"),
                config("badge", "badge.transparent"),
            ),
        )

        // Разделители приводятся к `_`; имя строится из стиля, а не из компонента:
        // одному компоненту соответствует несколько стилей.
        assertEquals(
            listOf("avatar_config.json", "badge_clear_config.json", "badge_transparent_config.json"),
            plan.configFiles.map { it.fileName },
        )
    }

    @Test
    fun reusesFileNameFromExistingPackage() {
        val existing = ExistingComponentPackage(
            entries = listOf(
                ComponentPackageMetaEntry("check-box", "check-box", "checkbox_config.json"),
                ComponentPackageMetaEntry("check-box", "check-box-group", "checkbox_group_config.json"),
            ),
            fileNames = listOf("checkbox_config.json", "checkbox_group_config.json"),
        )

        val plan = planOf(
            listOf(config("check-box", "check-box"), config("check-box", "check-box-group")),
            existing,
        )

        // Правило дало бы `check_box_config.json`: на существующем пакете это был бы
        // переименованный файл в каждом коммите.
        assertEquals(
            listOf("checkbox_config.json", "checkbox_group_config.json"),
            plan.configFiles.map { it.fileName },
        )
        assertTrue(plan.unrelatedFiles.isEmpty())
    }

    @Test
    fun appliesRuleOnlyToPairsAbsentFromExistingPackage() {
        val existing = ExistingComponentPackage(
            entries = listOf(ComponentPackageMetaEntry("check-box", "check-box", "checkbox_config.json")),
            fileNames = listOf("checkbox_config.json"),
        )

        val plan = planOf(
            listOf(config("check-box", "check-box"), config("chip", "chip-embedded")),
            existing,
        )

        assertEquals(
            listOf("checkbox_config.json", "chip_embedded_config.json"),
            plan.configFiles.map { it.fileName },
        )
    }

    @Test
    fun ordersEntriesByComponentThenStyle() {
        val plan = planOf(
            listOf(
                config("badge", "badge-solid"),
                config("avatar", "avatar"),
                config("badge", "badge-clear"),
            ),
        )

        assertEquals(
            listOf("avatar" to "avatar", "badge" to "badge-clear", "badge" to "badge-solid"),
            plan.configFiles.map { it.fileName }.map { name ->
                when (name) {
                    "avatar_config.json" -> "avatar" to "avatar"
                    "badge_clear_config.json" -> "badge" to "badge-clear"
                    else -> "badge" to "badge-solid"
                }
            },
        )
        // Тот же порядок и в meta.json: иначе повторная выгрузка давала бы дифф на пустом месте.
        assertTrue(plan.meta.content.indexOf("badge-clear") < plan.meta.content.indexOf("badge-solid"))
    }

    @Test
    fun rejectsCollisionOfFileNames() {
        val existing = ExistingComponentPackage(
            entries = listOf(ComponentPackageMetaEntry("chip", "chip", "chip_embedded_config.json")),
        )

        val result = builder.build(
            "sdds_serv",
            "0.6.0-rc",
            listOf(config("chip", "chip"), config("chip", "chip-embedded")),
            existing,
        )

        // Унаследованное имя совпало с тем, что правило даёт другой паре: писать по плану
        // нельзя, потому что вторая запись затёрла бы первую.
        val failure = result as? ComponentPackageWritePlanResult.Failed
            ?: fail("коллизия имён должна отклоняться")
        assertTrue(failure.message.contains("chip_embedded_config.json"))
        assertTrue(failure.message.contains("chip/chip"))
        assertTrue(failure.message.contains("chip/chip-embedded"))
    }

    @Test
    fun reportsFilesLeftFromPreviousComposition() {
        val existing = ExistingComponentPackage(
            entries = listOf(ComponentPackageMetaEntry("avatar", "avatar", "avatar_config.json")),
            fileNames = listOf("avatar_config.json", "meta.json", "spinner_config.json", "badge_config.json"),
        )

        val plan = planOf(listOf(config("avatar", "avatar")), existing)

        // `meta.json` сиротой не считается, остальные перечисляются в детерминированном порядке
        // и не удаляются: директория принадлежит разработчику.
        assertEquals(listOf("badge_config.json", "spinner_config.json"), plan.unrelatedFiles)
    }

    @Test
    fun writesMetaWithNameAndVersion() {
        val plan = planOf(listOf(config("avatar", "avatar")))

        assertEquals("meta.json", plan.meta.fileName)
        assertTrue(plan.meta.content.contains("\"sdds_serv\""))
        assertTrue(plan.meta.content.contains("\"0.6.0-rc\""))
        assertTrue(plan.meta.content.contains("\"avatar_config.json\""))
    }
}
