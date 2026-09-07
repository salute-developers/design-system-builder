package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.feature.docs.application.DocsCodec
import com.dsbuilder.frontend.feature.docs.domain.Manifest
import com.dsbuilder.frontend.feature.docs.domain.ResolvedDocs
import kotlinx.serialization.json.Json

/**
 * JSON codec для сериализации моделей пакета.
 */
internal class JsonDocsCodec(
    private val json: Json,
) : DocsCodec {
    override fun serializeResolvedDocs(docs: ResolvedDocs): String {
        return json.encodeToString(ResolvedDocs.serializer(), docs)
    }

    override fun serializeManifest(manifest: Manifest): String {
        return json.encodeToString(Manifest.serializer(), manifest)
    }
}
