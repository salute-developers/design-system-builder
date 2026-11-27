package com.dsbuilder.frontend.plugin.androidstudio.preview

import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.handler.CefCookieAccessFilter
import org.cef.handler.CefCookieAccessFilterAdapter
import org.cef.handler.CefRequestHandlerAdapter
import org.cef.handler.CefResourceHandler
import org.cef.handler.CefResourceHandlerAdapter
import org.cef.handler.CefResourceRequestHandler
import org.cef.handler.CefResourceRequestHandlerAdapter
import org.cef.misc.BoolRef
import org.cef.misc.IntRef
import org.cef.misc.StringRef
import org.cef.network.CefCookie
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.net.URI

internal class PreviewBrowserPolicy(private val origin: String, private val wrapperUrl: String) {
    fun permits(url: String, mainFrame: Boolean): Boolean {
        if (mainFrame) return url == wrapperUrl
        return runCatching { previewOrigin(URI(url)) == origin }.getOrDefault(false)
    }

    fun handler(
        html: () -> String,
        font: (String) -> PreviewFontResource? = { null },
    ): CefRequestHandlerAdapter = object : CefRequestHandlerAdapter() {
        override fun onBeforeBrowse(
            browser: CefBrowser,
            frame: CefFrame,
            request: CefRequest,
            userGesture: Boolean,
            isRedirect: Boolean,
        ): Boolean =
            !permits(request.url, frame.isMain)

        override fun onOpenURLFromTab(
            browser: CefBrowser,
            frame: CefFrame,
            targetUrl: String,
            userGesture: Boolean,
        ): Boolean = true

        override fun getResourceRequestHandler(
            browser: CefBrowser,
            frame: CefFrame,
            request: CefRequest,
            isNavigation: Boolean,
            isDownload: Boolean,
            requestInitiator: String,
            disableDefaultHandling: BoolRef,
        ): CefResourceRequestHandler = object : CefResourceRequestHandlerAdapter() {
            override fun onBeforeResourceLoad(
                browser: CefBrowser,
                frame: CefFrame,
                request: CefRequest,
            ): Boolean =
                !permits(request.url, frame.isMain) && !request.url.startsWith("blob:$origin/")

            override fun getResourceHandler(
                browser: CefBrowser,
                frame: CefFrame,
                request: CefRequest,
            ): CefResourceHandler? =
                if (frame.isMain && request.url == wrapperUrl) {
                    MemoryResource(html().toByteArray(Charsets.UTF_8), "text/html")
                } else {
                    font(request.url)?.let { MemoryResource(it.bytes, it.mimeType) }
                }

            override fun onResourceRedirect(
                browser: CefBrowser,
                frame: CefFrame,
                request: CefRequest,
                response: CefResponse,
                newUrl: StringRef,
            ) {
                if (!permits(newUrl.get(), frame.isMain)) newUrl.set("about:blank")
            }

            override fun getCookieAccessFilter(
                browser: CefBrowser,
                frame: CefFrame,
                request: CefRequest,
            ): CefCookieAccessFilter =
                object : CefCookieAccessFilterAdapter() {
                    override fun canSendCookie(
                        browser: CefBrowser,
                        frame: CefFrame,
                        request: CefRequest,
                        cookie: CefCookie,
                    ): Boolean = false
                    override fun canSaveCookie(
                        browser: CefBrowser,
                        frame: CefFrame,
                        request: CefRequest,
                        response: CefResponse,
                        cookie: CefCookie,
                    ): Boolean = false
                }
        }
    }
}

/** Отдаёт доверенную обёртку из памяти под обычным origin, без локального HTTP-сервера. */
private class MemoryResource(private val bytes: ByteArray, private val mimeType: String) : CefResourceHandlerAdapter() {
    private var offset = 0

    override fun processRequest(request: CefRequest, callback: CefCallback): Boolean {
        callback.Continue()
        return true
    }

    override fun getResponseHeaders(
        response: CefResponse,
        responseLength: IntRef,
        redirectUrl: StringRef,
    ) {
        response.status = 200
        response.mimeType = mimeType
        responseLength.set(bytes.size)
    }

    override fun readResponse(
        dataOut: ByteArray,
        bytesToRead: Int,
        bytesRead: IntRef,
        callback: CefCallback,
    ): Boolean {
        val length = minOf(bytesToRead, bytes.size - offset)
        bytes.copyInto(dataOut, 0, offset, offset + length)
        offset += length
        bytesRead.set(length)
        return length > 0
    }
}
