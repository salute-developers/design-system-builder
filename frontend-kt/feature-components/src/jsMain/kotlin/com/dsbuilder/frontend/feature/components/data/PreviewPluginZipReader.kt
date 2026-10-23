package com.dsbuilder.frontend.feature.components.data

internal actual class PreviewPluginZipReader actual constructor() {
    actual fun read(path: String): PreviewPluginZipRead =
        PreviewPluginZipRead.Failed("Error: reading a plugin archive is not supported on this platform.")
}
