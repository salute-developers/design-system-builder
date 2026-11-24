package com.dsbuilder.frontend.plugin.androidstudio.preview

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
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
    private val nativeBrowser = client.cefClient.createBrowser(wrapperUrl, false, false, context)
    val browser = JBCefBrowser(nativeBrowser, client)
    private val query = JBCefJSQuery.create(browser as JBCefBrowserBase)
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
            PreviewBrowserPolicy(origin, wrapperUrl).handler {
                wrapper(manifest.entrypoint.toString())
            },
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

    private fun wrapper(entrypoint: String): String {
        val bridge = query.inject("JSON.stringify({key:'$key',message:event.data})")
        return """
            <!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">
            <meta http-equiv="Content-Security-Policy"
              content="default-src 'none'; script-src 'nonce-$key'; frame-src $origin; style-src 'unsafe-inline'">
            <style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style></head><body>
            <iframe id="preview" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>
            <script nonce="$key">
            const frame=document.getElementById('preview');
            const origin=${scriptJson(string(origin).toString())};
            window.clearPreview=()=>{frame.style.opacity='0';};
            window.showPreview=()=>{frame.style.opacity='1';};
            window.sendPreview=message=>{
              if(message.type==='sdds.preview.payload'){
                frame.style.opacity='0';
              }
              frame.contentWindow.postMessage(message,origin);
            };
            window.addEventListener('message',event=>{
              if(event.source!==frame.contentWindow||event.origin!==origin)return;
              if(!event.data||typeof event.data!=='object')return;
              const accepted=['sdds.preview.ready','sdds.preview.result','sdds.preview.description'];
              if(!accepted.includes(event.data.type))return;
              $bridge;
            });
            frame.src=${scriptJson(string(entrypoint).toString())};
            </script></body></html>
        """.trimIndent()
    }

    suspend fun render(payload: JsonObject) {
        session.render(payload)
        browser.cefBrowser.executeJavaScript("window.showPreview()", wrapperUrl, 0)
    }

    fun clearFrame() {
        browser.cefBrowser.executeJavaScript("window.clearPreview()", wrapperUrl, 0)
    }

    override fun close() {
        session.dispose()
        scope.cancel()
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

private fun scriptJson(value: String): String = value.replace(
    "<",
    "\\u003c",
).replace(
    "\u2028",
    "\\u2028",
).replace(
    "\u2029",
    "\\u2029",
)
