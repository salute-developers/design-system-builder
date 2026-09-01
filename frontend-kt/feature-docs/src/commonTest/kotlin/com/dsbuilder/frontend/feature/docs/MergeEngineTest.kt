package com.dsbuilder.frontend.feature.docs

import com.dsbuilder.frontend.feature.docs.domain.MergeEngine
import com.dsbuilder.frontend.feature.docs.domain.NavigationNode
import com.dsbuilder.frontend.feature.docs.domain.Source
import com.dsbuilder.frontend.feature.docs.domain.Structure
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MergeEngineTest {

    @Test
    fun coreLeafWithoutUserOverrideKeepsCoreSource() {
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Group",
                    items = listOf(
                        NavigationNode(title = "Page", path = "page.md"),
                    ),
                ),
            ),
        )
        val user = Structure(schemaVersion = "1.0", navigation = emptyList())

        val resolved = MergeEngine.merge(core, user).navigation

        assertEquals(1, resolved.size)
        val group = resolved.single()
        assertEquals("Group", group.title)
        assertNull(group.path)
        assertEquals(1, group.items.size)
        val page = group.items.single()
        assertEquals("Page", page.title)
        assertEquals("page.md", page.path)
        assertEquals(1, page.contentRefs.size, "Expected single content ref, got: ${page.contentRefs}")
        assertEquals(Source.Core, page.contentRefs.single().source)
        assertEquals("content/core/page.md", page.contentRefs.single().path)
    }

    @Test
    fun coreLeafUnderGroupWithoutUserGroupOverrideKeepsCoreSource() {
        // Регрессия: раньше core-leaf под группой без user-override получал Source.User,
        // потому что buildResolvedLeafOrGroup вызывался с coreNode=null.
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Theme",
                    items = listOf(
                        NavigationNode(title = "Colors", path = "theme/Colors.md"),
                        NavigationNode(title = "Typography", path = "theme/Typography.md"),
                    ),
                ),
                NavigationNode(
                    title = "Visual Effects",
                    items = listOf(
                        NavigationNode(title = "Indication", path = "graphics/IndicationUsage.md"),
                    ),
                ),
            ),
        )
        val user = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Visual Effects",
                    items = listOf(
                        NavigationNode(
                            title = "Indication",
                            path = "graphics/IndicationUsage.md",
                            merge = com.dsbuilder.frontend.feature.docs.domain.MergePolicy.Append,
                        ),
                    ),
                ),
            ),
        )

        val resolved = MergeEngine.merge(core, user).navigation

        val theme = resolved.single { it.title == "Theme" }
        val colors = theme.items.single { it.title == "Colors" }
        val typography = theme.items.single { it.title == "Typography" }

        assertEquals(Source.Core, colors.contentRefs.single().source, "Colors должна быть Core")
        assertEquals(Source.Core, typography.contentRefs.single().source, "Typography должна быть Core")

        val effects = resolved.single { it.title == "Visual Effects" }
        val indication = effects.items.single { it.title == "Indication" }
        // Append: [core, user]
        assertEquals(2, indication.contentRefs.size, "Indication должна иметь 2 content refs")
        assertEquals(Source.Core, indication.contentRefs[0].source)
        assertEquals(Source.User, indication.contentRefs[1].source)
    }

    @Test
    fun userOnlyLeafIsAddedAsUserSource() {
        val core = Structure(schemaVersion = "1.0", navigation = emptyList())
        val user = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(title = "My Page", path = "user_only/page.md"),
            ),
        )

        val resolved = MergeEngine.merge(core, user).navigation

        assertEquals(1, resolved.size)
        val page = resolved.single()
        assertEquals(Source.User, page.contentRefs.single().source)
        assertEquals("content/user/user_only/page.md", page.contentRefs.single().path)
    }

    @Test
    fun userOnlyGroupAddsChildrenAsUserSource() {
        val core = Structure(schemaVersion = "1.0", navigation = emptyList())
        val user = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Custom",
                    items = listOf(
                        NavigationNode(title = "Sub", path = "sub.md"),
                    ),
                ),
            ),
        )

        val resolved = MergeEngine.merge(core, user).navigation

        val group = resolved.single()
        assertEquals("Custom", group.title)
        val sub = group.items.single()
        assertEquals(Source.User, sub.contentRefs.single().source)
    }

    @Test
    fun userLeafWithReplacePolicyReplacesCore() {
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(title = "Page", path = "core/page.md"),
            ),
        )
        val user = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Page",
                    path = "user/page.md",
                    merge = com.dsbuilder.frontend.feature.docs.domain.MergePolicy.Replace,
                ),
            ),
        )

        val resolved = MergeEngine.merge(core, user).navigation

        val page = resolved.single()
        assertEquals(1, page.contentRefs.size)
        assertEquals(Source.User, page.contentRefs.single().source)
        assertEquals("content/user/user/page.md", page.contentRefs.single().path)
    }

    @Test
    fun userLeafWithPrependPolicyPrependsToCore() {
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(NavigationNode(title = "Page", path = "core/page.md")),
        )
        val user = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Page",
                    path = "user/page.md",
                    merge = com.dsbuilder.frontend.feature.docs.domain.MergePolicy.Prepend,
                ),
            ),
        )

        val resolved = MergeEngine.merge(core, user).navigation
        val page = resolved.single()
        assertEquals(2, page.contentRefs.size)
        assertEquals(Source.User, page.contentRefs[0].source)
        assertEquals(Source.Core, page.contentRefs[1].source)
    }

    @Test
    fun userLeafWithAppendPolicyAppendsToCore() {
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(NavigationNode(title = "Page", path = "core/page.md")),
        )
        val user = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Page",
                    path = "user/page.md",
                    merge = com.dsbuilder.frontend.feature.docs.domain.MergePolicy.Append,
                ),
            ),
        )

        val resolved = MergeEngine.merge(core, user).navigation
        val page = resolved.single()
        assertEquals(2, page.contentRefs.size)
        assertEquals(Source.Core, page.contentRefs[0].source)
        assertEquals(Source.User, page.contentRefs[1].source)
    }

    @Test
    fun userLeafWithSamePathAsCoreAndNoMergePolicyMergesByDefaultAppend() {
        // По дизайну design.md: если user-leaf с тем же path (override того же файла),
        // merge-стратегия по умолчанию — append.
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(NavigationNode(title = "Page", path = "shared/page.md")),
        )
        val user = Structure(
            schemaVersion = "1.0",
            navigation = listOf(NavigationNode(title = "Page", path = "shared/page.md")),
        )

        val resolved = MergeEngine.merge(core, user).navigation
        val page = resolved.single()
        assertEquals(2, page.contentRefs.size)
        assertEquals(Source.Core, page.contentRefs[0].source)
        assertEquals(Source.User, page.contentRefs[1].source)
    }

    @Test
    fun hiddenUserLeafIsExcludedFromResult() {
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(title = "Visible", path = "visible.md"),
                NavigationNode(title = "Hidden", path = "hidden.md"),
            ),
        )
        val user = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(title = "Hidden", hidden = true),
            ),
        )

        val resolved = MergeEngine.merge(core, user).navigation

        assertEquals(1, resolved.size, "Hidden узел должен быть исключён")
        assertEquals("Visible", resolved.single().title)
    }

    @Test
    fun subjectsInheritFromParentGroup() {
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Group",
                    subjects = listOf("components"),
                    items = listOf(
                        NavigationNode(title = "Page", path = "page.md"),
                    ),
                ),
            ),
        )
        val user = Structure(schemaVersion = "1.0", navigation = emptyList())

        val resolved = MergeEngine.merge(core, user).navigation
        val group = resolved.single()
        assertEquals(listOf("components"), group.subjects)
        val page = group.items.single()
        assertEquals(listOf("components"), page.subjects, "Subjects должны наследоваться от родительской группы")
    }

    @Test
    fun subjectsOverrideInChildGroup() {
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Group",
                    subjects = listOf("components"),
                    items = listOf(
                        NavigationNode(
                            title = "Sub",
                            subjects = listOf("components.button"),
                            items = listOf(
                                NavigationNode(title = "Page", path = "page.md"),
                            ),
                        ),
                    ),
                ),
            ),
        )
        val user = Structure(schemaVersion = "1.0", navigation = emptyList())

        val resolved = MergeEngine.merge(core, user).navigation
        val sub = resolved.single().items.single()
        assertEquals(listOf("components.button"), sub.subjects)
        val page = sub.items.single()
        assertEquals(listOf("components.button"), page.subjects)
    }

    @Test
    fun duplicatedCoreLeavesProduceAllResults() {
        // Edge case: в core две группы с одинаковым title. Не идеально, но не должно падать.
        val core = Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Group",
                    items = listOf(
                        NavigationNode(title = "Page", path = "page1.md"),
                    ),
                ),
                NavigationNode(
                    title = "Group",
                    items = listOf(
                        NavigationNode(title = "Page", path = "page2.md"),
                    ),
                ),
            ),
        )
        val user = Structure(schemaVersion = "1.0", navigation = emptyList())

        val resolved = MergeEngine.merge(core, user).navigation

        assertTrue(resolved.size >= 1)
        resolved.forEach { g ->
            g.items.forEach { p ->
                assertEquals(Source.Core, p.contentRefs.single().source)
            }
        }
    }
}
