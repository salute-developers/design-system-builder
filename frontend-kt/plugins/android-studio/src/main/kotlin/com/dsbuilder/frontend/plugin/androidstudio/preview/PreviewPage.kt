package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.serialization.json.JsonObject

/** Доверенная HTML-обёртка: статусы не меняют геометрию встроенного превью. */
internal fun previewPage(
    entrypoint: String,
    origin: String,
    key: String,
    bridge: String,
    presentation: JsonObject,
): String = """
            <!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">
            <meta http-equiv="Content-Security-Policy"
              content="default-src 'none'; script-src 'nonce-$key'; frame-src $origin; style-src 'unsafe-inline'">
            <style>
            html,body,iframe{margin:0;width:100%;height:100%;border:0}
            body{background:#f9f9f9;color:#080808;font:13px system-ui,sans-serif;overflow:hidden}
            #status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
              z-index:1;pointer-events:none;padding:16px;box-sizing:border-box}
            #status[hidden]{display:none}
            #status span{max-width:100%;padding:8px 12px;border-radius:8px;background:var(--status-bg);
              box-shadow:0 2px 12px #0002;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere}
            </style></head><body>
            <iframe id="preview" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>
            <div id="status" role="status" aria-live="polite"><span></span></div>
            <script nonce="$key">
            const frame=document.getElementById('preview');
            const origin=${scriptJson(string(origin).toString())};
            window.updatePreviewPresentation=value=>{
              document.body.style.background=value.background;
              document.body.style.color=value.foreground;
              document.body.style.setProperty('--status-bg',value.background);
              const status=document.getElementById('status');
              status.firstElementChild.textContent=value.message;
              status.hidden=!value.message;
            };
            window.updatePreviewPresentation(${scriptJson(presentation.toString())});
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

internal fun scriptJson(value: String): String = value.replace(
    "<",
    "\\u003c",
).replace(
    "\u2028",
    "\\u2028",
).replace(
    "\u2029",
    "\\u2029",
)
