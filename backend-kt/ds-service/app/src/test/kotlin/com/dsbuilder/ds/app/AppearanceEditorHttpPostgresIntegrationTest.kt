package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** Операции редактора оформления: модель, оси, значения свойств, состояния, ссылки и конфигурации. */
@Suppress("LargeClass", "TooManyFunctions")
class AppearanceEditorHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = true }

    // ── модель и переименование ────────────────────────────────────────────────────────────────────

    @Test
    fun `the editor model reports axes locks revisions and the default configuration`() = withService {
        val fixture = fixture()
        val model = model(fixture.appearance)
        assertEquals("true", model.getValue("appearance").jsonObject.getValue("isDefault").jsonPrimitive.content)
        val axes = model.getValue("axes").jsonArray.map { it.jsonObject }
        assertEquals(listOf("view", "size"), axes.map { it.string("name") })
        assertEquals(listOf(true, false), axes.map { it.getValue("locked").jsonPrimitive.content.toBoolean() })
        assertEquals(listOf("a", "b"), axes[1].getValue("values").jsonArray.map { it.jsonObject.string("name") })
        assertNotNull(axes[1].getValue("revision").jsonPrimitive.content.toLongOrNull())
    }

    @Test
    fun `renaming an axis changes only its configuration and leaves catalog names and authored ids`() = withService {
        val fixture = fixture()
        val copy = duplicate(fixture.appearance, "Button copy")
        val size = axisOf(model(fixture.appearance), "size")
        val renamed = patch("/api/ds/appearance-variations/$size", """{"displayName":"scale"}""", base = 0)
        assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())

        assertEquals(listOf("view", "scale"), axisNames(model(fixture.appearance)))
        assertEquals(listOf("view", "size"), axisNames(model(copy)))
        val catalogName = "SELECT name FROM variations WHERE id = " +
            "(SELECT variation_id FROM appearance_variations WHERE id = '$size')"
        assertEquals("size", query(catalogName))
        assertTrue(renamed.headers["X-DS-Mutation-Metadata"].orEmpty().contains("appearance-variation"))
        assertEquals("/display_name", latestPaths(size))
        assertEquals(listOf("view", "scale"), exportedAxisNames(fixture.ds, "default"))
        assertEquals(listOf("view", "size"), exportedAxisNames(fixture.ds, "Button copy"))
    }

    @Test
    fun `the color scheme axis is locked and axis names stay distinct`() = withService {
        val fixture = fixture()
        val model = model(fixture.appearance)
        val view = axisOf(model, "view")
        val size = axisOf(model, "size")
        assertEquals("axis_locked", code(patch("/api/ds/appearance-variations/$view", """{"displayName":"scheme"}""")))
        assertEquals("axis_locked", code(delete("/api/ds/appearance-variations/$view")))
        val clash = patch("/api/ds/appearance-variations/$size", """{"displayName":"VIEW"}""")
        assertEquals("axis_name_taken", code(clash))
        val onlyValue = valueOf(model, "view", "default")
        assertEquals("axis_locked", code(delete("/api/ds/appearance-variation-values/$onlyValue")))
        val same = patch("/api/ds/appearance-variations/$size", """{"displayName":"size"}""")
        assertEquals(HttpStatusCode.OK, same.status)
    }

    @Test
    fun `a value rename is local and a catalog variation is renamed only by an administrator`() = withService {
        val fixture = fixture()
        val copy = duplicate(fixture.appearance, "Button copy")
        val value = valueOf(model(fixture.appearance), "size", "a")
        val renamed = patch("/api/ds/appearance-variation-values/$value", """{"displayName":"alpha"}""")
        assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())
        assertEquals(listOf("alpha", "b"), valueNames(model(fixture.appearance), "size"))
        assertEquals(listOf("a", "b"), valueNames(model(copy), "size"))
        val taken = patch("/api/ds/appearance-variation-values/$value", """{"displayName":"B"}""")
        assertEquals("value_name_taken", code(taken))

        val variation = query("SELECT id FROM variations WHERE name = 'size'")
        val denied = service.builder.client.patch("/api/ds/variations/$variation") {
            actor(admin = false, role = "owner")
            contentType(ContentType.Application.Json)
            setBody("""{"name":"scale"}""")
        }
        assertEquals(HttpStatusCode.Forbidden, denied.status, denied.bodyAsText())
        assertEquals("size", query("SELECT name FROM variations WHERE id = '$variation'"))
    }

    // ── оси ────────────────────────────────────────────────────────────────────────────────────────

    @Test
    fun `an axis is added with values ordered and removed with its dependent values`() = withService {
        val fixture = fixture()
        val axesPath = "/api/ds/appearances/${fixture.appearance}/axes"
        val added = post(axesPath, """{"name":"shape","values":["square","round"],"position":1}""")
        assertEquals(HttpStatusCode.Created, added.status, added.bodyAsText())
        val axis = json.parseToJsonElement(added.bodyAsText()).jsonObject
        assertEquals("shape", axis.string("name"))
        assertEquals(listOf("view", "shape", "size"), axisNames(model(fixture.appearance)))
        assertEquals("axis_name_taken", code(post(axesPath, """{"name":"Shape"}""")))

        val shape = axis.string("id")
        val square = valueOf(model(fixture.appearance), "shape", "square")
        val round = valueOf(model(fixture.appearance), "shape", "round")
        val reordered = put("$axesPath/$shape/value-order", """{"valueIds":["$round","$square"]}""")
        assertEquals(HttpStatusCode.OK, reordered.status, reordered.bodyAsText())
        assertEquals(listOf("round", "square"), valueNames(model(fixture.appearance), "shape"))
        val ids = listOf("size", "shape", "view").map { axisOf(model(fixture.appearance), it) }
        val orderPath = "/api/ds/appearances/${fixture.appearance}/axis-order"
        val moved = post(orderPath, """{"axisIds":[${ids.joinToString(",") { "\"$it\"" }}]}""")
        assertEquals(HttpStatusCode.OK, moved.status, moved.bodyAsText())
        assertEquals(listOf("size", "shape", "view"), axisNames(model(fixture.appearance)))
        assertEquals("invalid_order", code(post(orderPath, """{"axisIds":["$shape"]}""")))

        val styleSquare = styleOf(model(fixture.appearance), "shape", "square")
        val padding = property("padding", "dimension")
        assertEquals(HttpStatusCode.OK, setValue(fixture.appearance, padding, listOf(styleSquare), value = "4").status)
        val removed = delete("$axesPath/$shape")
        assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
        val count = json.parseToJsonElement(removed.bodyAsText()).jsonObject.getValue("removedDependents")
        assertEquals("1", count.jsonPrimitive.content)
        assertEquals(listOf("size", "view"), axisNames(model(fixture.appearance)))
        assertTrue(propertyValues(fixture.appearance).none { it.string("propertyName") == "padding" })
    }

    @Test
    fun `a value is added to an axis and removed with a default style cleared`() = withService {
        val fixture = fixture()
        val size = axisOf(model(fixture.appearance), "size")
        val valuesPath = "/api/ds/appearances/${fixture.appearance}/axes/$size/values"
        val added = post(valuesPath, """{"name":"c","position":0}""")
        assertEquals(HttpStatusCode.Created, added.status, added.bodyAsText())
        assertEquals(listOf("c", "a", "b"), valueNames(model(fixture.appearance), "size"))
        assertEquals("value_name_taken", code(post(valuesPath, """{"name":"C"}""")))
        val c = valueOf(model(fixture.appearance), "size", "c")
        val removed = delete("/api/ds/appearances/${fixture.appearance}/axis-values/$c")
        assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
        assertEquals(listOf("a", "b"), valueNames(model(fixture.appearance), "size"))
    }

    // ── значения свойств и состояния ───────────────────────────────────────────────────────────────

    @Test
    fun `a value is set for the base a style and a combination with ordered states`() = withService {
        val fixture = fixture()
        val padding = property("padding", "dimension")
        val model = model(fixture.appearance)
        val styleA = styleOf(model, "size", "a")
        val styleDefault = styleOf(model, "view", "default")

        assertEquals(HttpStatusCode.OK, setValue(fixture.appearance, padding, emptyList(), value = "1").status)
        assertEquals(HttpStatusCode.OK, setValue(fixture.appearance, padding, listOf(styleA), value = "2").status)
        val combination = setValue(fixture.appearance, padding, listOf(styleA, styleDefault), value = "3")
        assertEquals(HttpStatusCode.OK, combination.status, combination.bodyAsText())
        val kinds = propertyValues(fixture.appearance).map { it.string("kind") }
        assertEquals(listOf("combination", "invariant", "variation"), kinds.sorted())

        val pressed = setValue(fixture.appearance, padding, listOf(styleA), value = "5", states = listOf("pressed"))
        assertEquals(HttpStatusCode.OK, pressed.status, pressed.bodyAsText())
        val hovered = setValue(fixture.appearance, padding, listOf(styleA), value = "6", states = listOf("hovered"))
        assertEquals(HttpStatusCode.OK, hovered.status, hovered.bodyAsText())
        val stored = valuesOf(fixture.appearance, padding, styleA)
        assertEquals("2", stored.first { it.states().isEmpty() }.string("value"))
        assertEquals("5", stored.first { it.states() == listOf("pressed") }.string("value"))

        val orderPath = "/api/ds/appearances/${fixture.appearance}/state-order"
        val swapped = """{"propertyId":"$padding","styleIds":["$styleA"],"states":[["hovered"],["pressed"]]}"""
        val order = put(orderPath, swapped)
        assertEquals(HttpStatusCode.OK, order.status, order.bodyAsText())
        val ordered = valuesOf(fixture.appearance, padding, styleA).filter { it.states().isNotEmpty() }
            .sortedBy { it.getValue("position").jsonPrimitive.content.toInt() }
        assertEquals(listOf(listOf("hovered"), listOf("pressed")), ordered.map { it.states() })
        val partial = put(orderPath, """{"propertyId":"$padding","styleIds":["$styleA"],"states":[["hovered"]]}""")
        assertEquals("invalid_order", code(partial))

        val scope = "propertyId=$padding&styleIds=$styleA&states=pressed"
        val valuesPath = "/api/ds/appearances/${fixture.appearance}/property-values"
        val removed = service.builder.client.delete("$valuesPath?$scope") { actor() }
        assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
        assertTrue(valuesOf(fixture.appearance, padding, styleA).none { it.states() == listOf("pressed") })
    }

    @Test
    fun `an unknown state a foreign scope and an incompatible type are rejected without changes`() = withService {
        val fixture = fixture()
        val padding = property("padding", "dimension")
        val fill = property("fill", "color")
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        val unknown = setValue(fixture.appearance, padding, listOf(styleA), value = "1", states = listOf("levitating"))
        assertEquals("unknown_state", code(unknown))
        val foreign = setValue(fixture.appearance, padding, listOf(MISSING_ID), value = "1")
        assertEquals("invalid_scope", code(foreign))
        val mismatch = setValue(fixture.appearance, padding, listOf(styleA), value = "red", type = "typography")
        assertEquals("incompatible_value_type", code(mismatch))
        assertEquals("0", query("SELECT count(*) FROM variation_property_value_revisions"))
        val gradient = setValue(fixture.appearance, fill, listOf(styleA), value = "#fff", type = "gradient")
        assertEquals(HttpStatusCode.OK, gradient.status)
    }

    @Test
    fun `a token reference stores the token id with an empty value and follows a rename`() = withService {
        val fixture = fixture()
        val fill = property("fill", "color")
        val tokenBody = """{"designSystemId":"${fixture.ds}","name":"surface","type":"color"}"""
        val token = id(post("/api/ds/tokens", tokenBody).bodyAsText())
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        val set = setValue(fixture.appearance, fill, listOf(styleA), token = token)
        assertEquals(HttpStatusCode.OK, set.status, set.bodyAsText())
        val stored = "SELECT token_id || '|' || coalesce(value, '') FROM variation_property_value_revisions " +
            "ORDER BY version_sequence_number DESC LIMIT 1"
        assertEquals("$token|", query(stored))
        assertEquals(HttpStatusCode.OK, patch("/api/ds/tokens/$token", """{"name":"surface-renamed"}""").status)
        val value = valuesOf(fixture.appearance, fill, styleA).single()
        assertEquals(token, value.string("tokenId"))
        assertTrue(value.getValue("value") is JsonNull)
        assertEquals("token_not_found", code(setValue(fixture.appearance, fill, listOf(styleA), token = MISSING_ID)))
    }

    // ── вложенные компоненты ───────────────────────────────────────────────────────────────────────

    @Test
    fun `a nested style reference is written validated rebuilt on rename and protects its target`() = withService {
        val fixture = fixture()
        val child = importChild(fixture.ds)
        val nested = property("buttonStyle", "component_style")
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        val childX = styleOf(model(child), "size", "x")

        val set = setValue(fixture.appearance, nested, listOf(styleA), reference = reference(child, childX))
        assertEquals(HttpStatusCode.OK, set.status, set.bodyAsText())
        val written = valuesOf(fixture.appearance, nested, styleA).single()
        assertEquals("Child.x", written.string("value"))
        assertEquals("Child.x", written.getValue("reference").jsonObject.string("reference"))
        assertEquals("1", query("SELECT count(*) FROM component_style_references"))
        assertEquals("1", query("SELECT count(*) FROM component_deps WHERE type = 'reuse'"))

        val stateful = setValue(
            fixture.appearance,
            nested,
            listOf(styleA),
            states = listOf("pressed"),
            reference = reference(child, childX),
        )
        assertEquals(HttpStatusCode.OK, stateful.status, stateful.bodyAsText())
        assertEquals("2", query("SELECT count(*) FROM component_style_references"))

        val xValue = valueOf(model(child), "size", "x")
        val renamed = patch("/api/ds/appearance-variation-values/$xValue", """{"displayName":"xl"}""")
        assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())
        val texts = valuesOf(fixture.appearance, nested, styleA)
            .map { it.getValue("reference").jsonObject.string("reference") }
        assertEquals(setOf("Child.xl"), texts.toSet())
        // Экспорт читает текст ссылки из самого значения-владельца.
        assertEquals(setOf("Child.xl"), valuesOf(fixture.appearance, nested, styleA).map { it.string("value") }.toSet())

        val childSize = axisOf(model(child), "size")
        assertEquals("reference_in_use", code(delete("/api/ds/appearances/$child")))
        assertEquals("reference_in_use", code(delete("/api/ds/appearances/$child/axes/$childSize")))
        val cascaded = delete("/api/ds/appearances/$child/axes/$childSize?confirmCascade=true")
        assertEquals(HttpStatusCode.OK, cascaded.status, cascaded.bodyAsText())
        assertTrue(valuesOf(fixture.appearance, nested, styleA).isEmpty())
    }

    @Test
    fun `a nested reference rejects a missing target foreign styles cycles and chains over the limit`() = withService {
        val fixture = fixture()
        val child = importChild(fixture.ds)
        val nested = property("buttonStyle", "component_style")
        val childNested = property("childStyle", "component_style", component = "Child")
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        val childX = styleOf(model(child), "size", "x")
        suspend fun set(target: String, vararg styles: String) =
            setValue(fixture.appearance, nested, listOf(styleA), reference = reference(target, *styles))

        assertEquals("reference_target_not_found", code(set(MISSING_ID)))
        assertEquals("reference_invalid_styles", code(set(child, styleA)))
        val padding = property("padding", "dimension")
        val misplaced = setValue(
            fixture.appearance,
            padding,
            listOf(styleA),
            value = "1",
            reference = reference(child, childX),
        )
        assertEquals("reference_not_allowed", code(misplaced))
        assertEquals("reference_cycle", code(set(fixture.appearance)))

        assertEquals(HttpStatusCode.OK, set(child, childX).status)
        val back = setValue(child, childNested, listOf(childX), reference = reference(fixture.appearance, styleA))
        assertEquals("reference_cycle", code(back))
    }

    // ── конфигурации ───────────────────────────────────────────────────────────────────────────────

    @Test
    fun `a new configuration gets a color scheme axis and the default one cannot be removed`() = withService {
        val fixture = fixture()
        val newBody = """{"designSystemId":"${fixture.ds}","componentId":"${fixture.component}"}"""
        val created = post("/api/ds/appearances/new", newBody)
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val appearance = json.parseToJsonElement(created.bodyAsText()).jsonObject
        assertEquals("Button new", appearance.string("name"))
        assertEquals("false", appearance.getValue("isDefault").jsonPrimitive.content)
        val model = model(appearance.string("id"))
        assertEquals(listOf("view"), axisNames(model))
        val axis = model.getValue("axes").jsonArray.single().jsonObject
        assertEquals("true", axis.getValue("locked").jsonPrimitive.content)
        assertEquals(emptyList(), model.getValue("propertyValues").jsonArray.toList())
        val named = """{"designSystemId":"${fixture.ds}","componentId":"${fixture.component}","name":"button new"}"""
        assertEquals("appearance_name_taken", code(post("/api/ds/appearances/new", named)))

        assertEquals("default_appearance_protected", code(delete("/api/ds/appearances/${fixture.appearance}")))
        val renamed = patch("/api/ds/appearances/${fixture.appearance}", """{"name":"Main"}""")
        assertEquals(HttpStatusCode.OK, renamed.status)
        assertEquals(HttpStatusCode.OK, delete("/api/ds/appearances/${appearance.string("id")}").status)
    }

    @Test
    fun `a duplicate is independent keeps states and references and repeats with the same key`() = withService {
        val fixture = fixture()
        val child = importChild(fixture.ds)
        val padding = property("padding", "dimension")
        val nested = property("buttonStyle", "component_style")
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        val childX = styleOf(model(child), "size", "x")
        setValue(fixture.appearance, padding, listOf(styleA), value = "2")
        setValue(fixture.appearance, padding, listOf(styleA), value = "5", states = listOf("pressed"))
        setValue(fixture.appearance, nested, listOf(styleA), reference = reference(child, childX))

        val path = "/api/ds/appearances/${fixture.appearance}/duplicate"
        val first = post(path, """{"name":"Copy"}""", key = "dup-1")
        val replay = post(path, """{"name":"Copy"}""", key = "dup-1")
        assertEquals(HttpStatusCode.Created, first.status, first.bodyAsText())
        assertEquals(first.bodyAsText(), replay.bodyAsText())
        val copy = json.parseToJsonElement(first.bodyAsText()).jsonObject.string("id")
        assertEquals("1", query("SELECT count(*) FROM (${latestAppearances()}) a WHERE name = 'Copy'"))
        assertEquals(listOf("view", "size"), axisNames(model(copy)))
        val copiedA = styleOf(model(copy), "size", "a")
        val copiedStates = valuesOf(copy, padding, copiedA).map { it.states() }.toSet()
        assertEquals(setOf(listOf<String>(), listOf("pressed")), copiedStates)
        val copiedReference = valuesOf(copy, nested, copiedA).single().getValue("reference").jsonObject
        assertEquals("Child.x", copiedReference.string("reference"))

        setValue(copy, padding, listOf(copiedA), value = "9")
        val original = valuesOf(fixture.appearance, padding, styleA).first { it.states().isEmpty() }
        assertEquals("2", original.string("value"))
    }

    @Test
    fun `parallel edits of different entities merge and the same field is reported as overwritten`() = withService {
        val fixture = fixture()
        val model = model(fixture.appearance)
        val size = axisOf(model, "size")
        val value = valueOf(model, "size", "a")
        val base = query("SELECT revision::text FROM entity_edit_states WHERE entity_id = '$size'").toLong()

        val first = patch("/api/ds/appearance-variations/$size", """{"displayName":"scale"}""", base = base)
        assertEquals(HttpStatusCode.OK, first.status, first.bodyAsText())
        assertTrue(first.headers["X-DS-Mutation-Metadata"].orEmpty().contains("\"warnings\": []"))
        val other = patch("/api/ds/appearance-variation-values/$value", """{"displayName":"alpha"}""", base = 0)
        assertEquals(HttpStatusCode.OK, other.status, other.bodyAsText())
        val stale = patch("/api/ds/appearance-variations/$size", """{"displayName":"measure"}""", base = base)
        assertEquals(HttpStatusCode.OK, stale.status, stale.bodyAsText())
        assertTrue(stale.headers["X-DS-Mutation-Metadata"].orEmpty().contains("/display_name"))
        assertEquals(listOf("view", "measure"), axisNames(model(fixture.appearance)))
    }

    // ── журнал и откат ─────────────────────────────────────────────────────────────────────────────

    @Test
    fun `a rename is journaled and its revert restores the previous name`() = withService {
        val fixture = fixture()
        publish(fixture.ds)
        val size = axisOf(model(fixture.appearance), "size")
        val renamed = patch("/api/ds/appearance-variations/$size", """{"displayName":"scale"}""")
        assertEquals(HttpStatusCode.OK, renamed.status)

        val change = changes(fixture.ds).single {
            it.string("entityType") == "appearance-variation" && it.string("entityId") == size &&
                it.getValue("changedPaths").jsonArray.any { path -> path.jsonPrimitive.content == "/display_name" }
        }
        assertEquals("updated", change.string("operation"))
        val reverted = revert(fixture.ds, change)
        assertEquals(HttpStatusCode.OK, reverted.status, reverted.bodyAsText())
        assertEquals(listOf("view", "size"), axisNames(model(fixture.appearance)))
    }

    @Test
    fun `reverting the creation of an axis that already carries values is refused without a cascade`() = withService {
        val fixture = fixture()
        val added = post("/api/ds/appearances/${fixture.appearance}/axes", """{"name":"shape","values":["square"]}""")
        assertEquals(HttpStatusCode.Created, added.status, added.bodyAsText())
        val axis = json.parseToJsonElement(added.bodyAsText()).jsonObject.string("id")
        val padding = property("padding", "dimension")
        val square = styleOf(model(fixture.appearance), "shape", "square")
        assertEquals(HttpStatusCode.OK, setValue(fixture.appearance, padding, listOf(square), value = "4").status)

        val creation = changes(fixture.ds).single {
            it.string("entityType") == "appearance-variation" && it.string("entityId") == axis
        }
        val reverted = revert(fixture.ds, creation)
        assertEquals(HttpStatusCode.Conflict, reverted.status, reverted.bodyAsText())
        assertEquals("REVERT_DEPENDENCY_CONFLICT", code(reverted))
        assertEquals(listOf("shape", "size", "view"), axisNames(model(fixture.appearance)).sorted())
    }

    // ── импорт и права ─────────────────────────────────────────────────────────────────────────────

    @Test
    fun `an import keeps display names of axes and values`() = withService {
        val fixture = fixture()
        val size = axisOf(model(fixture.appearance), "size")
        patch("/api/ds/appearance-variations/$size", """{"displayName":"scale"}""")
        val value = valueOf(model(fixture.appearance), "scale", "a")
        patch("/api/ds/appearance-variation-values/$value", """{"displayName":"alpha"}""")

        val again = importConfig(fixture.ds, "default", config("view", "scale", values = listOf("alpha", "b")))
        assertEquals(HttpStatusCode.OK, again.status, again.bodyAsText())
        val model = model(fixture.appearance)
        assertEquals(listOf("view", "scale"), axisNames(model))
        assertEquals(listOf("alpha", "b"), valueNames(model, "scale"))
        assertEquals("true", model.getValue("appearance").jsonObject.getValue("isDefault").jsonPrimitive.content)
        val scale = axisOf(model, "scale")
        assertEquals(
            "size",
            query(
                "SELECT name FROM variations WHERE id = " +
                    "(SELECT variation_id FROM appearance_variations WHERE id = '$scale')",
            ),
        )
    }

    @Test
    fun `a viewer cannot change the model and a foreign design system is not found`() = withService {
        val fixture = fixture()
        val denied = service.builder.client.post("/api/ds/appearances/${fixture.appearance}/axes") {
            actor(admin = false, role = "viewer")
            contentType(ContentType.Application.Json)
            setBody("""{"name":"shape"}""")
        }
        // Дизайн-система фикстуры глобальная для проекта-читателя: запись недоступна, оформление не раскрывается.
        assertTrue(denied.status == HttpStatusCode.Forbidden || denied.status == HttpStatusCode.NotFound)
        assertEquals("1", query("SELECT count(*) FROM variations WHERE name = 'size'"))
        val unknown = get("/api/ds/appearances/$MISSING_ID/editor-model")
        assertEquals(HttpStatusCode.NotFound, unknown.status)
    }

    @Test
    fun `axis creation repeats the saved result and a legacy delete leaves own values to the client`() = withService {
        val fixture = fixture()
        val path = "/api/ds/appearances/${fixture.appearance}/axes"
        val first = post(path, """{"name":"shape","values":["square"]}""", key = "axis-1")
        val replay = post(path, """{"name":"shape","values":["square"]}""", key = "axis-1")
        assertEquals(HttpStatusCode.Created, first.status, first.bodyAsText())
        assertEquals(first.bodyAsText(), replay.bodyAsText())
        assertEquals(listOf("view", "size", "shape"), axisNames(model(fixture.appearance)))

        val padding = property("padding", "dimension")
        val square = styleOf(model(fixture.appearance), "shape", "square")
        setValue(fixture.appearance, padding, listOf(square), value = "4")
        val squareValue = valueOf(model(fixture.appearance), "shape", "square")
        val removed = delete("/api/ds/appearance-variation-values/$squareValue")
        assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
        assertTrue(valueNames(model(fixture.appearance), "shape").isEmpty())
    }

    @Test
    fun `removals and reorders repeat the saved result for the same key`() = withService {
        val fixture = fixture()
        post("/api/ds/appearances/${fixture.appearance}/axes", """{"name":"shape","values":["square"]}""")
        val shape = axisOf(model(fixture.appearance), "shape")
        val path = "/api/ds/appearances/${fixture.appearance}/axes/$shape"
        val first = delete(path, key = "remove-1")
        val replay = delete(path, key = "remove-1")
        assertEquals(HttpStatusCode.OK, first.status, first.bodyAsText())
        assertEquals(HttpStatusCode.OK, replay.status, replay.bodyAsText())
        assertEquals(first.bodyAsText(), replay.bodyAsText())
        assertEquals(HttpStatusCode.NotFound, delete(path, key = "remove-2").status)
    }

    @Test
    fun `a combination is found by its styles and written in the key order of the import`() = withService {
        val fixture = fixture()
        val values = """["a","b","c","d","e","f"]"""
        post("/api/ds/appearances/${fixture.appearance}/axes", """{"name":"shape","values":$values}""")
        post("/api/ds/appearances/${fixture.appearance}/axes", """{"name":"tone","values":$values}""")
        val padding = property("padding", "dimension")
        val model = model(fixture.appearance)
        val shapes = valueNames(model, "shape").map { styleOf(model, "shape", it) }
        val tones = valueNames(model, "tone").map { styleOf(model, "tone", it) }
        val pair = shapes.flatMap { left -> tones.map { right -> left to right } }.first { (left, right) ->
            (left < right) != (UUID.fromString(left) < UUID.fromString(right))
        }.toList()
        val key = pair.map(UUID::fromString).sorted().joinToString(",")
        assertEquals(HttpStatusCode.OK, setValue(fixture.appearance, padding, pair, value = "1").status)
        assertEquals(HttpStatusCode.OK, setValue(fixture.appearance, padding, pair, value = "2").status)
        assertEquals(
            "1",
            query("SELECT count(*) FROM style_combination_revisions WHERE combination_key = '$key' AND NOT deleted"),
        )
        val stored = propertyValues(fixture.appearance).filter { value ->
            value.string("propertyId") == padding &&
                value.getValue("styleIds").jsonArray.map { it.jsonPrimitive.content }.toSet() == pair.toSet()
        }
        assertEquals("2", stored.single().string("value"))
        val scope = "propertyId=$padding&styleIds=${pair.joinToString(",")}"
        val removed = delete("/api/ds/appearances/${fixture.appearance}/property-values?$scope")
        assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
    }

    @Test
    fun `a published version is read as it was and token names follow renames`() = withService {
        val fixture = fixture()
        val fill = property("fill", "color")
        val tokenBody = """{"designSystemId":"${fixture.ds}","name":"surface","type":"color"}"""
        val token = id(post("/api/ds/tokens", tokenBody).bodyAsText())
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        setValue(fixture.appearance, fill, listOf(styleA), token = token)
        publish(fixture.ds)
        val version = query(
            "SELECT id::text FROM design_system_versions " +
                "WHERE design_system_id = '${fixture.ds}' AND status = 'published'",
        )

        val size = axisOf(model(fixture.appearance), "size")
        patch("/api/ds/appearance-variations/$size", """{"displayName":"scale"}""")
        patch("/api/ds/tokens/$token", """{"name":"surface-renamed"}""")

        val current = model(fixture.appearance)
        assertEquals(listOf("view", "scale"), axisNames(current))
        assertEquals("surface-renamed", valuesOf(fixture.appearance, fill, styleA).single().string("tokenName"))
        val old = get("/api/ds/appearances/${fixture.appearance}/editor-model?versionId=$version")
        assertEquals(HttpStatusCode.OK, old.status, old.bodyAsText())
        val oldModel = json.parseToJsonElement(old.bodyAsText()).jsonObject
        assertEquals(listOf("view", "size"), axisNames(oldModel))
    }

    @Test
    fun `reordering the axes of a target rebuilds the text of references to it`() = withService {
        val fixture = fixture()
        val child = importChild(fixture.ds)
        val nested = property("buttonStyle", "component_style")
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        val childX = styleOf(model(child), "size", "x")
        val childDefault = styleOf(model(child), "view", "default")
        setValue(fixture.appearance, nested, listOf(styleA), reference = reference(child, childX, childDefault))
        assertEquals("Child.default.x", valuesOf(fixture.appearance, nested, styleA).single().string("value"))

        val ids = listOf("size", "view").map { axisOf(model(child), it) }
        val orderPath = "/api/ds/appearances/$child/axis-order"
        val moved = post(orderPath, """{"axisIds":[${ids.joinToString(",") { "\"$it\"" }}]}""")
        assertEquals(HttpStatusCode.OK, moved.status, moved.bodyAsText())
        val text = valuesOf(fixture.appearance, nested, styleA).single().getValue("reference").jsonObject
        assertEquals("Child.x.default", text.string("reference"))
    }

    @Test
    fun `an import writes references of valued states`() = withService {
        val fixture = fixture()
        importChild(fixture.ds)
        val nested = property("buttonStyle", "component_style")
        val body = """{"colorSchemeVariationId":"view","invariants":{},"variations":[
            {"id":"view","name":"view","values":[{"name":"default","properties":{}}]},
            {"id":"size","name":"size","values":[
              {"name":"a","properties":{"buttonStyle":{"type":"component_style","value":"Child.x",
                "states":[{"state":["pressed"],"type":"component_style","value":"Child.y"}]}}},
              {"name":"b","properties":{}}]}]}"""
        val imported = importConfig(fixture.ds, "default", body)
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        val references = valuesOf(fixture.appearance, nested, styleA)
            .associate { it.states() to it.getValue("reference") }
        assertEquals(setOf(listOf<String>(), listOf("pressed")), references.keys)
        assertTrue(references.values.all { it !is JsonNull })
    }

    @Test
    fun `an import resolves references by the display names of the target`() = withService {
        val fixture = fixture()
        val child = importChild(fixture.ds)
        val nested = property("buttonStyle", "component_style")
        val xValue = valueOf(model(child), "size", "x")
        patch("/api/ds/appearance-variation-values/$xValue", """{"displayName":"xl"}""")
        val body = """{"colorSchemeVariationId":"view","invariants":{},"variations":[
            {"id":"view","name":"view","values":[{"name":"default","properties":{}}]},
            {"id":"size","name":"size","values":[
              {"name":"a","properties":{"buttonStyle":{"type":"component_style","value":"Child.xl"}}},
              {"name":"b","properties":{}}]}]}"""
        val imported = importConfig(fixture.ds, "default", body)
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        val styleA = styleOf(model(fixture.appearance), "size", "a")
        val stored = valuesOf(fixture.appearance, nested, styleA).single()
        assertEquals("Child.xl", stored.getValue("reference").jsonObject.string("reference"))
    }

    @Test
    fun `an import with names that point to different axes after a swap is rejected`() = withService {
        val fixture = fixture()
        post("/api/ds/appearances/${fixture.appearance}/axes", """{"name":"kind","values":["p"]}""")
        val kind = axisOf(model(fixture.appearance), "kind")
        val size = axisOf(model(fixture.appearance), "size")
        patch("/api/ds/appearance-variations/$kind", """{"displayName":"tmp"}""")
        patch("/api/ds/appearance-variations/$size", """{"displayName":"kind"}""")
        patch("/api/ds/appearance-variations/$kind", """{"displayName":"size"}""")
        val before = axisNames(model(fixture.appearance))

        val body = """{"colorSchemeVariationId":"view","invariants":{},"variations":[
            {"id":"view","name":"view","values":[{"name":"default","properties":{}}]},
            {"id":"kind","name":"kind","values":[{"name":"p","properties":{}}]},
            {"id":"size","name":"size","values":[{"name":"a","properties":{}}]}]}"""
        val rejected = importConfig(fixture.ds, "default", body)
        assertTrue(rejected.bodyAsText().contains("display name of one axis"), rejected.bodyAsText())
        assertEquals(before, axisNames(model(fixture.appearance)))
    }

    // ── фикстуры ───────────────────────────────────────────────────────────────────────────────────

    private class Fixture(val ds: String, val component: String, val appearance: String)

    private suspend fun fixture(): Fixture {
        val ds = id(post("/api/ds/design-systems", """{"name":"alpha","projectName":"alpha"}""").bodyAsText())
        val component = id(post("/api/ds/components", """{"name":"Button","platform":"compose"}""").bodyAsText())
        post("/api/ds/components", """{"name":"Child","platform":"compose"}""")
        val imported = importConfig(ds, "default", config("view", "size"))
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        return Fixture(ds, component, appearanceNamed("default"))
    }

    private suspend fun importChild(ds: String): String {
        // Первое оформление компонента — конфигурация по умолчанию и не удаляется, поэтому цель — второе.
        val main = importConfig(ds, "ChildMain", config("view", "size"), component = "child")
        assertEquals(HttpStatusCode.OK, main.status, main.bodyAsText())
        val target = importConfig(ds, "Child", config("view", "size", values = listOf("x", "y")), component = "child")
        assertEquals(HttpStatusCode.OK, target.status, target.bodyAsText())
        return appearanceNamed("Child")
    }

    private fun config(scheme: String, size: String, values: List<String> = listOf("a", "b")): String {
        val sizeValues = values.joinToString(",") { """{"name":"$it","properties":{}}""" }
        return """{"colorSchemeVariationId":"$scheme","invariants":{},"variations":[
            {"id":"$scheme","name":"$scheme","values":[{"name":"default","properties":{}}]},
            {"id":"$size","name":"$size","values":[$sizeValues]}]}"""
    }

    private suspend fun importConfig(
        ds: String,
        style: String,
        config: String,
        component: String = "button",
    ): HttpResponse = post(
        "/api/ds/component-config/import",
        """{"designSystemId":"$ds","platform":"compose","meta":{"name":"fixture","source":"kotlin-test"},
           "dryRun":false,"components":[{"componentName":"$component","styleName":"$style","config":$config}]}""",
    )

    private suspend fun property(name: String, type: String, component: String = "Button"): String {
        val componentId = query("SELECT id FROM components WHERE name = '$component'")
        val existing = query(
            "SELECT coalesce((SELECT id::text FROM properties " +
                "WHERE component_id = '$componentId' AND name = '$name'), '')",
        )
        if (existing.isNotEmpty()) return existing
        val response = post("/api/ds/properties", """{"componentId":"$componentId","name":"$name","type":"$type"}""")
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return id(response.bodyAsText())
    }

    private suspend fun duplicate(appearance: String, name: String): String {
        val response = post("/api/ds/appearances/$appearance/duplicate", """{"name":"$name"}""")
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return id(response.bodyAsText())
    }

    /** Публикует активный черновик, чтобы последующие правки журналировались как изменения опубликованного. */
    private suspend fun publish(ds: String) {
        val draft = "SELECT %s FROM design_system_versions WHERE design_system_id = '$ds' AND status = 'draft'"
        val response = post(
            "/api/ds/design-system-versions",
            """{"designSystemId":"$ds","draftId":"${query(draft.format("id::text"))}",""" +
                """"draftRevision":${query(draft.format("resolved_draft_revision(id)::text"))},""" +
                """"version":"2.0.0","changelog":"fixture"}""",
            key = "publish-$ds",
        )
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
    }

    private fun reference(target: String, vararg styles: String): String =
        """{"targetAppearanceId":"$target","styleIds":[${styles.joinToString(",") { "\"$it\"" }}]}"""

    private fun latestAppearances() = "SELECT * FROM (SELECT DISTINCT ON (appearance_id) * FROM appearance_revisions " +
        "ORDER BY appearance_id, version_sequence_number DESC) latest WHERE NOT deleted"

    private fun appearanceNamed(name: String) =
        query("SELECT appearance_id FROM (${latestAppearances()}) a WHERE name = '$name'")

    private fun latestPaths(entityId: String) = query(
        "SELECT string_agg(path, ',') FROM entity_edit_paths WHERE entity_id = '$entityId' AND last_revision = " +
            "(SELECT max(last_revision) FROM entity_edit_paths WHERE entity_id = '$entityId')",
    )

    // ── чтение ответов ─────────────────────────────────────────────────────────────────────────────

    private suspend fun model(appearance: String): JsonObject {
        val response = get("/api/ds/appearances/$appearance/editor-model")
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return json.parseToJsonElement(response.bodyAsText()).jsonObject
    }

    private suspend fun propertyValues(appearance: String): List<JsonObject> =
        model(appearance).getValue("propertyValues").jsonArray.map { it.jsonObject }

    private suspend fun valuesOf(appearance: String, property: String, style: String): List<JsonObject> =
        propertyValues(appearance).filter { value ->
            val styles = value.getValue("styleIds").jsonArray.map { it.jsonPrimitive.content }
            value.string("propertyId") == property && styles == listOf(style)
        }

    private fun JsonObject.states(): List<String> = getValue("states").jsonArray.map { it.jsonPrimitive.content }

    private suspend fun setValue(
        appearance: String,
        property: String,
        styles: List<String>,
        value: String? = null,
        states: List<String> = emptyList(),
        token: String? = null,
        type: String? = null,
        reference: String? = null,
    ): HttpResponse {
        fun list(items: List<String>) = items.joinToString(",") { "\"$it\"" }
        val body = buildString {
            append("""{"propertyId":"$property","styleIds":[${list(styles)}],"states":[${list(states)}]""")
            value?.let { append(""","value":"$it"""") }
            token?.let { append(""","tokenId":"$it"""") }
            type?.let { append(""","type":"$it"""") }
            reference?.let { append(""","reference":$it""") }
            append("}")
        }
        return put("/api/ds/appearances/$appearance/property-values", body)
    }

    private suspend fun changes(ds: String): List<JsonObject> {
        val response = get("/api/ds/design-systems/$ds/changes")
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val body = json.parseToJsonElement(response.bodyAsText())
        val array = (body as? JsonArray) ?: body.jsonObject.getValue("changes").jsonArray
        return array.map { it.jsonObject }
    }

    private suspend fun revert(ds: String, change: JsonObject): HttpResponse =
        service.builder.client.post("/api/ds/design-systems/$ds/changes/${change.string("changeId")}/revert") {
            actor()
            header("X-DS-Base-Revision", change.getValue("editRevision").jsonPrimitive.content)
            header("Idempotency-Key", "revert-${change.string("changeId")}")
        }

    private fun axisNames(model: JsonObject) = model.getValue("axes").jsonArray.map { it.jsonObject.string("name") }

    private fun axis(model: JsonObject, name: String): JsonObject =
        model.getValue("axes").jsonArray.map { it.jsonObject }.single { it.string("name") == name }

    private fun axisOf(model: JsonObject, name: String): String = axis(model, name).string("id")

    private fun valueNames(model: JsonObject, axis: String): List<String> =
        axis(model, axis).getValue("values").jsonArray.map { it.jsonObject.string("name") }

    private fun valueRow(model: JsonObject, axis: String, value: String): JsonObject =
        axis(model, axis).getValue("values").jsonArray.map { it.jsonObject }.single { it.string("name") == value }

    private fun valueOf(model: JsonObject, axis: String, value: String): String =
        valueRow(model, axis, value).string("id")

    private fun styleOf(model: JsonObject, axis: String, value: String): String =
        valueRow(model, axis, value).string("styleId")

    private suspend fun exportedAxisNames(ds: String, style: String): List<String> {
        val response = post("/api/ds/component-config/export", """{"designSystemId":"$ds","platform":"compose"}""")
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val config = json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("components").jsonArray
            .map { it.jsonObject }
            .single { it.string("componentName").equals("Button", true) && it.string("styleName") == style }
            .getValue("config").jsonObject
        return config.getValue("variations").jsonArray.map { it.jsonObject.string("name") }
    }

    private suspend fun code(response: HttpResponse): String {
        val body = response.bodyAsText()
        val parsed = json.parseToJsonElement(body).jsonObject
        return parsed["code"]?.jsonPrimitive?.content ?: parsed["error"]?.jsonPrimitive?.content ?: body
    }

    private fun JsonObject.string(name: String): String =
        getValue(name).let { if (it is JsonNull) "" else it.jsonPrimitive.content }

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend AppearanceEditorHttpPostgresIntegrationTest.() -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                service = Service(postgres, this)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private suspend fun post(path: String, body: String, key: String? = null) = service.builder.client.post(path) {
        actor()
        key?.let { header("Idempotency-Key", it) }
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun put(path: String, body: String) = service.builder.client.put(path) {
        actor()
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun patch(path: String, body: String, base: Long? = null) = service.builder.client.patch(path) {
        actor()
        base?.let { header("X-DS-Base-Revision", it) }
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun delete(path: String, key: String? = null) = service.builder.client.delete(path) {
        actor()
        key?.let { header("Idempotency-Key", it) }
    }

    private suspend fun get(path: String) = service.builder.client.get(path) { actor() }

    private fun HttpRequestBuilder.actor(admin: Boolean = true, role: String = "viewer") {
        header("X-Actor-Type", "user")
        header("X-User-Id", if (admin) "integration-admin" else "integration-user")
        header("X-Project-Id", if (admin) "global" else "project-a")
        if (!admin) header("X-Project-Role", role)
        header("X-System-Admin", admin.toString())
    }

    private fun configuration(postgres: IsolatedPostgresDatabase) = DsServiceConfiguration(
        port = 0,
        databaseUrl = postgres.jdbcUrl,
        databaseUser = postgres.username,
        databasePassword = postgres.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
    )

    private fun id(body: String): String = json.parseToJsonElement(body).jsonObject.getValue("id").jsonPrimitive.content

    private fun query(sql: String): String = DriverManager.getConnection(
        service.postgres.jdbcUrl,
        service.postgres.username,
        service.postgres.password,
    ).use {
        it.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows ->
                rows.next()
                rows.getString(1)
            }
        }
    }

    private companion object {
        const val MISSING_ID = "00000000-0000-0000-0000-000000000001"
    }
}
