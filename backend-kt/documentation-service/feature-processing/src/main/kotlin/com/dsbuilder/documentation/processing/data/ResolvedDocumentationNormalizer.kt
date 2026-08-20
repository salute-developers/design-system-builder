package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.processing.application.AdapterExecution
import com.dsbuilder.documentation.processing.application.DocumentationNormalizer
import com.dsbuilder.documentation.processing.application.NormalizedCandidate
import com.dsbuilder.documentation.processing.application.ProcessingFailure
import com.dsbuilder.documentation.processing.application.PublicationContextProvider
import com.dsbuilder.documentation.processing.application.ResolvedContentSource
import com.dsbuilder.documentation.processing.application.ResolvedDocumentationNode
import com.dsbuilder.documentation.processing.application.StructuredArtifactAdapterRegistry
import com.dsbuilder.documentation.processing.application.ValidatedBundle
import com.dsbuilder.documentation.publication.domain.ContentSource
import com.dsbuilder.documentation.publication.domain.DocumentationAsset
import com.dsbuilder.documentation.publication.domain.DocumentationContent
import com.dsbuilder.documentation.publication.domain.DocumentationNavigationNode
import com.dsbuilder.documentation.publication.domain.DocumentationPage
import com.dsbuilder.documentation.publication.domain.DocumentationPublication
import com.dsbuilder.documentation.publication.domain.NavigationNodeKind
import com.dsbuilder.documentation.publication.domain.PublicationStatus
import com.dsbuilder.documentation.publication.domain.StructuredArtifact
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

/** Детерминированно нормализует validated resolved documentation. */
class ResolvedDocumentationNormalizer(
    private val contexts: PublicationContextProvider,
    private val keys: PublicationObjectKeyPolicy,
    private val adapters: StructuredArtifactAdapterRegistry = StructuredArtifactAdapterRegistry(
        supportedStructuredArtifactAdapters(),
    ),
) : DocumentationNormalizer {
    override suspend fun normalize(job: IngestionJob, bundle: ValidatedBundle): NormalizedCandidate {
        val publicationId = requireNotNull(job.publicationId) { "Job publicationId is required" }
        val context = contexts.get(job)
        val state = NormalizationState(publicationId, bundle.extracted.root, keys)
        bundle.documentation.navigation.forEachIndexed { ordinal, node -> state.addNode(node, null, ordinal) }
        val structured = context.structuredArtifacts.map { declaration ->
            val format = declaration.format ?: throw ProcessingFailure(
                "MISSING_ARTIFACT_FORMAT",
                "Structured artifact format is required",
                false,
            )
            val source = bundle.extracted.root.resolve(declaration.path)
            val artifact = StructuredArtifact(
                id = state.deterministicId("artifact", declaration.type.name),
                publicationId = publicationId,
                type = declaration.type,
                format = format,
                storageKey = keys.key(publicationId, declaration.path),
                sha256 = source.sha256(),
                size = Files.size(source),
            )
            val adapted = adapters.adapt(job.id, artifact, context.key.platform, Files.readString(source))
            when (adapted) {
                is AdapterExecution.Completed -> Triple(artifact, adapted.result.bindings, adapted.result.lookupTerms)
                is AdapterExecution.Failed -> throw ProcessingFailure(
                    adapted.diagnostic.code,
                    adapted.diagnostic.message,
                    false,
                )
            }
        }
        return NormalizedCandidate(
            sourceRoot = bundle.extracted.root,
            publication = DocumentationPublication(
                id = publicationId,
                projectId = context.projectId,
                bundleId = job.bundleId,
                key = context.key,
                status = PublicationStatus.CANDIDATE,
                createdAt = job.createdAt,
            ),
            navigation = state.navigation,
            pages = state.pages,
            content = state.content,
            assets = state.assets(),
            contentAssets = state.contentAssetLinks(),
            structuredArtifacts = structured.map { it.first },
            bindings = structured.flatMap { it.second },
            lookupTerms = structured.flatMap { it.third },
        )
    }
}

private class NormalizationState(
    private val publicationId: String,
    private val root: Path,
    private val keys: PublicationObjectKeyPolicy,
) {
    val navigation = mutableListOf<DocumentationNavigationNode>()
    val pages = mutableListOf<DocumentationPage>()
    val content = mutableListOf<DocumentationContent>()
    private val links = mutableListOf<Pair<String, String>>()

    fun addNode(node: ResolvedDocumentationNode, parentId: String?, ordinal: Int) {
        val identity = node.path ?: "group:${parentId.orEmpty()}:$ordinal:${node.title}"
        val navigationId = deterministicId("navigation", identity)
        navigation += DocumentationNavigationNode(
            id = navigationId,
            publicationId = publicationId,
            parentId = parentId,
            kind = if (node.path == null) NavigationNodeKind.GROUP else NavigationNodeKind.PAGE,
            title = node.title,
            pagePath = node.path,
            ordinal = ordinal,
        )
        node.path?.let { addPage(node, it) }
        node.items.forEachIndexed { childOrdinal, child -> addNode(child, navigationId, childOrdinal) }
    }

    fun assets(): List<DocumentationAsset> {
        val assetsRoot = root.resolve(ASSETS_ROOT)
        if (!Files.isDirectory(assetsRoot)) return emptyList()
        return Files.walk(assetsRoot).use { paths ->
            paths.filter(Files::isRegularFile)
                .map(::asset)
                .sorted(compareBy(DocumentationAsset::path))
                .toList()
        }
    }

    fun contentAssetLinks() = links.map { (contentId, path) ->
        com.dsbuilder.documentation.processing.application.ContentAssetLink(contentId, deterministicId("asset", path))
    }

    private fun addPage(node: ResolvedDocumentationNode, path: String) {
        val pageId = deterministicId("page", path)
        pages += DocumentationPage(pageId, publicationId, path, node.title, node.subjects)
        node.contentRefs.forEachIndexed { ordinal, reference ->
            val file = root.resolve(reference.path)
            content += DocumentationContent(
                id = deterministicId("content", "$path:$ordinal:${reference.path}"),
                pageId = pageId,
                sourcePath = reference.path,
                source = when (reference.source) {
                    ResolvedContentSource.CORE -> ContentSource.CORE
                    ResolvedContentSource.USER -> ContentSource.USER
                },
                ordinal = ordinal,
                storageKey = keys.key(publicationId, reference.path),
                sha256 = file.sha256(),
                size = Files.size(file),
            )
            ASSET_PATTERN.findAll(Files.readString(file)).forEach { match ->
                val destination = match.groupValues[1].substringBefore('#').substringBefore('?')
                val resolved = root.relativize(
                    file.parent.resolve(destination).normalize(),
                ).toString().replace('\\', '/')
                if (resolved.startsWith("assets/")) links += content.last().id to resolved
            }
        }
    }

    private fun asset(file: Path): DocumentationAsset {
        val path = root.relativize(file).toString().replace('\\', '/')
        return DocumentationAsset(
            id = deterministicId("asset", path),
            publicationId = publicationId,
            path = path,
            storageKey = keys.key(publicationId, path),
            mediaType = Files.probeContentType(file) ?: "application/octet-stream",
            sha256 = file.sha256(),
            size = Files.size(file),
        )
    }

    fun deterministicId(kind: String, key: String): String = "$kind-" +
        MessageDigest.getInstance("SHA-256")
            .digest("$publicationId\u0000$kind\u0000$key".toByteArray())
            .take(ID_BYTES)
            .joinToString("") { byte -> "%02x".format(byte) }

    private companion object {
        const val ASSETS_ROOT = "assets"
        const val ID_BYTES = 16
        val ASSET_PATTERN = Regex("!\\[[^]]*]\\(([^ )]+)")
    }
}

private fun Path.sha256(): String = Files.newInputStream(this).use { input ->
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    generateSequence { input.read(buffer).takeIf { it >= 0 } }
        .forEach { count -> if (count > 0) digest.update(buffer, 0, count) }
    digest.digest().joinToString("") { byte -> "%02x".format(byte) }
}
