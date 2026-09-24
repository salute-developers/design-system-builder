package com.dsbuilder.frontend.plugin.androidstudio.codereference

import java.awt.Toolkit
import java.awt.datatransfer.StringSelection

/** Копирует текст в системный буфер обмена. */
public object ClipboardCopier {
    /** Копирует [text] в системный буфер обмена. */
    public fun copy(text: String) {
        Toolkit.getDefaultToolkit().systemClipboard.setContents(StringSelection(text), null)
    }
}
