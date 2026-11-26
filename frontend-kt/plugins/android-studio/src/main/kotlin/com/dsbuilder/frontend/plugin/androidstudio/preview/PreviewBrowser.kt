package com.dsbuilder.frontend.plugin.androidstudio.preview

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.intellij.ui.jcef.CefOsrBrowserFactory
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.intellij.ui.jcef.JBCefOSRHandlerFactory
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.swing.Swing
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import org.cef.CefApp
import org.cef.CefBrowserSettings
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.browser.CefRequestContext
import org.cef.handler.CefLifeSpanHandlerAdapter
import java.util.UUID

/** Одна изолированная сессия браузера на раздел; API-клиент и секреты в неё не передаются. */
internal class PreviewBrowser private constructor(val manifest: PreviewManifest) : AutoCloseable {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Swing)
    private val origin = previewOrigin(manifest.entrypoint)
    private val key = UUID.randomUUID().toString()
    private val wrapperUrl = "${manifest.entrypoint.scheme}://dsbuilder-preview.invalid/${UUID.randomUUID()}/index.html"
    private val client = JBCefApp.getInstance().createClient()
    private val context = CefRequestContext.createContext(null)
    private val nativeBrowser = CefOsrBrowserFactory.getInstance().createOsrBrowser(
        JBCefOSRHandlerFactory.getInstance(),
        client.cefClient,
        wrapperUrl,
        context,
        null,
        null,
        true,
        CefBrowserSettings().apply { windowless_frame_rate = 30 },
    )
    val browser = JBCefBrowser.createBuilder().setClient(client).setCefBrowser(nativeBrowser)
        .setOffScreenRendering(true).build()

    // Адреса assets видит iframe; их идентификатор не должен раскрывать секрет моста.
    private val fonts = PreviewFontAssets(manifest.entrypoint.resolve("./.ide-fonts/${UUID.randomUUID()}/"))
    private val query = JBCefJSQuery.create(browser as JBCefBrowserBase)

    @Volatile
    private var presentation = presentation("Загружаем превью…", "light")
    val session = PreviewSession(
        send = { message ->
            val value = scriptJson(message.toString())
            browser.cefBrowser.executeJavaScript("window.sendPreview($value)", wrapperUrl, 0)
        },
    )

    init {
        query.addHandler { request ->
            // Функция маршрутизатора существует и в дочерних фреймах. Случайный ключ доступен
            // только доверенной обёртке; удалённый фрейм не может обойти её проверку origin/source.
            if (request.length <= 1_048_576) {
                val envelope = runCatching { ApiJson.parseToJsonElement(request) as JsonObject }.getOrNull()
                if (envelope?.text("key") == key) scope.launch { session.receive(envelope.obj("message")) }
            }
            null
        }
        client.addRequestHandler(
            PreviewBrowserPolicy(origin, wrapperUrl).handler(
                { wrapper(manifest.entrypoint.toString()) },
                fonts::resource,
            ),
            nativeBrowser,
        )
        client.addLifeSpanHandler(
            object : CefLifeSpanHandlerAdapter() {
                override fun onBeforePopup(
                    browser: CefBrowser,
                    frame: CefFrame,
                    targetUrl: String,
                    targetFrameName: String,
                ): Boolean = true
            },
            nativeBrowser,
        )
    }

    private fun wrapper(entrypoint: String): String = previewPage(
        entrypoint,
        origin,
        key,
        query.inject("JSON.stringify({key:'$key',message:event.data})"),
        presentation,
    )

    suspend fun render(payload: JsonObject) {
        session.render(fonts.prepare(payload))
        browser.cefBrowser.executeJavaScript("window.showPreview()", wrapperUrl, 0)
    }

    fun clearFrame() {
        browser.cefBrowser.executeJavaScript("window.clearPreview()", wrapperUrl, 0)
    }

    fun showStatus(message: String, mode: String) {
        presentation = presentation(message, mode)
        browser.cefBrowser.executeJavaScript(
            "window.updatePreviewPresentation(${scriptJson(presentation.toString())})",
            wrapperUrl,
            0,
        )
    }

    override fun close() {
        session.dispose()
        scope.cancel()
        fonts.close()
        query.dispose()
        browser.dispose()
        client.dispose()
        context.dispose()
    }
    companion object {
        suspend fun create(manifest: PreviewManifest): PreviewBrowser = withContext(Dispatchers.Swing) {
            val initializer = JBCefBrowser.createBuilder().setOffScreenRendering(
                true,
            ).setCreateImmediately(true).build()
            try {
                if (CefApp.getState() != CefApp.CefAppState.INITIALIZED) {
                    val initialized = CompletableDeferred<Unit>()
                    CefApp.getInstance().onInitialization { state ->
                        if (state == CefApp.CefAppState.INITIALIZED) initialized.complete(Unit)
                    }
                    withTimeout(30_000) { initialized.await() }
                }
                PreviewBrowser(manifest)
            } finally {
                initializer.dispose()
            }
        }
    }
}

private fun presentation(message: String, mode: String): JsonObject = jsonObject(
    "message" to string(message),
    "background" to string(previewSurfaceBackground(mode)),
    "foreground" to string(if (mode == "dark") "#F9F9F9" else "#080808"),
)
