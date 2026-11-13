package com.dsbuilder.frontend.feature.auth.presentation

/** Автономная браузерная страница результата CLI/MCP без параметров OAuth и внешних ресурсов. */
public object BrowserLoginPage {
    /** Заголовки приватности и ограничения содержимого для loopback-ответа. */
    public val headers: Map<String, String> = mapOf(
        "Content-Type" to "text/html; charset=utf-8",
        "Cache-Control" to "no-store",
        "Referrer-Policy" to "no-referrer",
        "X-Content-Type-Options" to "nosniff",
        "Content-Security-Policy" to "default-src 'none'; style-src 'unsafe-inline'; " +
            "img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    )

    /** Показывает успех только по результату сохранения сессии, без отражения входных данных. */
    public fun render(success: Boolean): String {
        val title = if (success) "Вы успешно авторизованы" else "Не удалось завершить вход"
        val message = if (success) {
            "Можете закрыть вкладку."
        } else {
            "Вернитесь в терминал и повторите auth login. Можете закрыть вкладку."
        }
        val symbol = if (success) "&#10003;" else "!"
        return """
            <!doctype html>
            <html lang="ru">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta name="referrer" content="no-referrer">
                <link rel="icon" href="data:,">
                <title>DS Builder — $title</title>
                <style>
                    :root { color-scheme: dark; }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0; min-height: 100vh; min-height: 100dvh; padding: 32px 16px;
                        display: grid; place-items: center; background: #27282c; color: #e8eaee;
                        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    }
                    main { width: 100%; max-width: 440px; text-align: center; }
                    .brand { margin: 0 0 32px; color: #b8bec6; font-size: 14px; font-weight: 600; }
                    .symbol {
                        width: 56px; height: 56px; margin: 0 auto 24px; border-radius: 50%;
                        display: grid; place-items: center; background: #166dc4; color: white;
                        font-size: 28px; line-height: 1;
                    }
                    h1 { margin: 0; font-size: 24px; font-weight: 600; line-height: 30px; }
                    .message { margin: 12px 0 0; color: #b8bec6; font-size: 14px; line-height: 20px; }
                </style>
            </head>
            <body>
                <main>
                    <p class="brand">SDDS · DS Builder</p>
                    <div class="symbol" aria-hidden="true">$symbol</div>
                    <h1>$title</h1>
                    <p class="message">$message</p>
                </main>
            </body>
            </html>
        """.trimIndent()
    }
}
