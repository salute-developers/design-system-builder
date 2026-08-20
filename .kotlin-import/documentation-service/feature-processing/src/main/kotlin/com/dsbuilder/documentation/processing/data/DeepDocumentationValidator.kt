package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.processing.application.DocumentationValidator
import com.dsbuilder.documentation.processing.application.ExtractedBundle
import com.dsbuilder.documentation.processing.application.ResolvedContentReference
import com.dsbuilder.documentation.processing.application.ResolvedContentSource
import com.dsbuilder.documentation.processing.application.ResolvedDocumentation
import com.dsbuilder.documentation.processing.application.ResolvedDocumentationNode
import com.dsbuilder.documentation.processing.application.ValidatedBundle
import com.dsbuilder.documentation.publication.domain.DiagnosticLevel
import com.dsbuilder.documentation.publication.domain.ProcessingDiagnostic
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.commonmark.Extension
import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.node.AbstractVisitor
import org.commonmark.node.Image
import org.commonmark.node.Link
import org.commonmark.parser.Parser
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

/** Лимиты deep validation resolved documentation. */
data class DocumentationValidationLimits(
    /** Максимальное число navigation nodes. */
    val maxNavigationNodes: Int = 10_000,
    /** Максимальная глубина navigation tree. */
    val maxNavigationDepth: Int = 32,
    /** Максимальное число страниц. */
    val maxPages: Int = 5_000,
    /** Максимальное число content references. */
    val maxContentFiles: Int = 10_000,
    /** Максимальный размер строкового поля в байтах. */
    val maxStringBytes: Int = 65_536,
    /** Максимальный размер bundle-relative path в байтах. */
    val maxPathBytes: Int = 1_024,
    /** Максимальный размер одного файла в байтах. */
    val maxFileBytes: Long = 10L * 1024 * 1024,
)

/** Строго разбирает и глубоко валидирует `dsb-resolved-docs-v1`. */
class DeepDocumentationValidator(
    private val limits: DocumentationValidationLimits = DocumentationValidationLimits(),
    private val json: Json = Json { ignoreUnknownKeys = false },
    extensions: List<Extension> = listOf(TablesExtension.create()),
) : DocumentationValidator {
    private val markdown = Parser.builder().extensions(extensions).build()

    override suspend fun validate(job: IngestionJob, bundle: ExtractedBundle): ValidatedBundle {
        val diagnostics = mutableListOf<ProcessingDiagnostic>()
        val input = parseDocs(job, bundle.root, diagnostics)
        val state = ValidationState(job, bundle.root, diagnostics)
        val document = try {
            ResolvedDocumentation(input.navigation.map { state.validateNode(it, 1) })
        } catch (_: ValidationLimitExceeded) {
            ResolvedDocumentation(emptyList())
        }
        state.validateUnusedAssets()
        return ValidatedBundle(bundle, document, diagnostics)
    }

    private fun parseDocs(
        job: IngestionJob,
        root: Path,
        diagnostics: MutableList<ProcessingDiagnostic>,
    ): ResolvedDocsInput {
        val path = root.resolve(DOCS_PATH)
        return try {
            if (!Files.isRegularFile(path) || Files.size(path) > limits.maxFileBytes) {
                error("missing or oversized docs.json")
            }
            json.decodeFromString(readUtf8(path))
        } catch (_: IllegalStateException) {
            diagnostics += invalidDocsDiagnostic(job)
            ResolvedDocsInput(emptyList())
        } catch (_: java.io.IOException) {
            diagnostics += invalidDocsDiagnostic(job)
            ResolvedDocsInput(emptyList())
        } catch (_: kotlinx.serialization.SerializationException) {
            diagnostics += invalidDocsDiagnostic(job)
            ResolvedDocsInput(emptyList())
        } catch (_: StackOverflowError) {
            diagnostics += invalidDocsDiagnostic(job)
            ResolvedDocsInput(emptyList())
        }
    }

    private fun invalidDocsDiagnostic(job: IngestionJob): ProcessingDiagnostic =
        diagnostic(job.id, DiagnosticLevel.ERROR, "INVALID_RESOLVED_DOCS", "Invalid docs.json", DOCS_PATH)

    private inner class ValidationState(
        private val job: IngestionJob,
        private val root: Path,
        private val diagnostics: MutableList<ProcessingDiagnostic>,
    ) {
        private val pagePaths = hashSetOf<String>()
        private val referencedAssets = hashSetOf<String>()
        private var nodes = 0
        private var pages = 0
        private var contentFiles = 0

        fun validateNode(input: NavigationNodeInput, depth: Int): ResolvedDocumentationNode {
            if (depth > limits.maxNavigationDepth) {
                limitExceeded("NAVIGATION_TOO_DEEP", "Navigation is too deep")
            }
            if (++nodes > limits.maxNavigationNodes) {
                limitExceeded("TOO_MANY_NAVIGATION_NODES", "Too many navigation nodes")
            }
            validateText(input.title, "title")
            val page = input.path != null
            val group = input.items.isNotEmpty()
            if (page == group) {
                error(
                    "INVALID_NAVIGATION_NODE",
                    "Navigation node must be either group or page",
                    input.path,
                )
            }
            if (page) validatePage(input)
            val subjects = input.subjects.onEach(::validateSubject)
            return ResolvedDocumentationNode(
                title = input.title,
                subjects = subjects,
                hidden = input.hidden ?: false,
                items = input.items.map { validateNode(it, depth + 1) },
                path = input.path?.let(::safePath),
                contentFormat = input.contentFormat,
                contentRefs = input.contentRefs.map(::validateContentReference),
            )
        }

        fun validateUnusedAssets() {
            val assetsRoot = root.resolve(ASSETS_ROOT)
            if (!Files.exists(assetsRoot)) return
            Files.walk(assetsRoot).use { paths ->
                paths.filter(Files::isRegularFile).forEach { file ->
                    val relative = bundlePath(file)
                    if (relative !in referencedAssets) {
                        warning("UNUSED_ASSET", "Asset is not referenced by markdown", relative)
                    }
                }
            }
        }

        private fun validatePage(input: NavigationNodeInput) {
            if (++pages > limits.maxPages) limitExceeded("TOO_MANY_PAGES", "Too many documentation pages")
            val path = safePath(requireNotNull(input.path))
            if (!pagePaths.add(path)) error("DUPLICATE_PAGE_PATH", "Page path is duplicated", path)
            if (input.items.isNotEmpty()) error("PAGE_HAS_CHILDREN", "Page must not contain child nodes", path)
            if (input.contentFormat != MARKDOWN_FORMAT) {
                error(
                    "UNSUPPORTED_CONTENT_FORMAT",
                    "Only markdown is supported",
                    path,
                )
            }
            if (input.contentRefs.isEmpty()) error("MISSING_CONTENT_REF", "Page must contain contentRefs", path)
            if (input.subjects.isEmpty()) warning("PAGE_WITHOUT_SUBJECTS", "Page has no subjects", path)
        }

        private fun validateContentReference(input: ContentReferenceInput): ResolvedContentReference {
            if (++contentFiles > limits.maxContentFiles) {
                limitExceeded("TOO_MANY_CONTENT_FILES", "Too many content files")
            }
            val path = safePath(input.path)
            val file = root.resolve(path).normalize()
            if (!file.startsWith(root) || !Files.isRegularFile(file)) {
                error("MISSING_CONTENT_REF", "Content reference is missing", path)
            } else if (Files.size(file) > limits.maxFileBytes) {
                error("CONTENT_FILE_TOO_LARGE", "Content file is too large", path)
            } else {
                validateMarkdown(path, file)
            }
            return ResolvedContentReference(
                source = when (input.source) {
                    ContentSourceInput.Core -> ResolvedContentSource.CORE
                    ContentSourceInput.User -> ResolvedContentSource.USER
                },
                path = path,
            )
        }

        private fun validateMarkdown(sourcePath: String, file: Path) {
            val source = try {
                readUtf8(file)
            } catch (_: java.nio.charset.CharacterCodingException) {
                error("INVALID_MARKDOWN_ENCODING", "Markdown must be UTF-8", sourcePath)
                return
            }
            markdown.parse(source).accept(
                object : AbstractVisitor() {
                    override fun visit(image: Image) {
                        validateLocalReference(sourcePath, image.destination, true)
                        visitChildren(image)
                    }

                    override fun visit(link: Link) {
                        validateLocalReference(sourcePath, link.destination, false)
                        visitChildren(link)
                    }
                },
            )
        }

        private fun validateLocalReference(sourcePath: String, destination: String, image: Boolean) {
            val pathPart = destination.substringBefore('#').substringBefore('?')
            if (pathPart.isBlank() || destination.startsWith('#') || isExternal(destination)) return
            if (pathPart.startsWith('/') || pathPart.startsWith('\\')) {
                error("UNSAFE_LOCAL_REFERENCE", "Local markdown reference is unsafe", sourcePath)
                return
            }
            val resolved = root.resolve(sourcePath).parent.resolve(pathPart).normalize()
            if (!resolved.startsWith(root)) {
                error("UNSAFE_LOCAL_REFERENCE", "Local markdown reference is unsafe", sourcePath)
            } else if (!Files.isRegularFile(resolved)) {
                error(
                    if (image) "MISSING_LOCAL_ASSET" else "MISSING_LOCAL_LINK",
                    "Local markdown target is missing",
                    sourcePath,
                )
            } else if (resolved.startsWith(root.resolve(ASSETS_ROOT))) {
                referencedAssets += bundlePath(resolved)
            }
        }

        private fun safePath(value: String): String {
            validateText(value, "path")
            val normalized = value.replace('\\', '/').trimStart('/')
            val segments = normalized.split('/')
            val absolute = value.startsWith('/') || value.startsWith('\\')
            val invalidSegment = segments.any { it.isBlank() || it == "." || it == ".." }
            val invalid = absolute || value.indexOf('\u0000') >= 0 || invalidSegment
            if (invalid || value.toByteArray().size > limits.maxPathBytes) {
                error("UNSAFE_PATH", "Bundle-relative path is unsafe", value)
            }
            return segments.joinToString("/")
        }

        private fun validateSubject(value: String) {
            validateText(value, "subject")
            val validPrefix = value.startsWith("components.") || value.startsWith("tokens.")
            val segments = value.split('.')
            val invalidCharacter = value.any { it.isWhitespace() || it.isISOControl() }
            val invalidSegments = segments.size < 2 || segments.any(String::isBlank)
            if (!validPrefix || invalidSegments || invalidCharacter) {
                error("INVALID_SUBJECT", "Subject does not match canonical grammar", subject = value)
            }
        }

        private fun validateText(value: String, field: String) {
            if (value.isBlank() || value.toByteArray().size > limits.maxStringBytes) {
                error("INVALID_STRING", "Invalid or oversized $field")
            }
        }

        private fun error(code: String, message: String, path: String? = null, subject: String? = null) {
            diagnostics += diagnostic(job.id, DiagnosticLevel.ERROR, code, message, path, subject)
        }

        private fun limitExceeded(code: String, message: String): Nothing {
            error(code, message)
            throw ValidationLimitExceeded
        }

        private fun warning(code: String, message: String, path: String? = null) {
            diagnostics += diagnostic(job.id, DiagnosticLevel.WARNING, code, message, path)
        }

        private fun bundlePath(path: Path): String = root.relativize(path).toString().replace('\\', '/')
    }

    private fun readUtf8(path: Path): String = StandardCharsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(Files.readAllBytes(path)))
        .toString()

    private fun diagnostic(
        jobId: String,
        level: DiagnosticLevel,
        code: String,
        message: String,
        path: String? = null,
        subject: String? = null,
    ): ProcessingDiagnostic {
        val key = listOf(jobId, level.name, code, path.orEmpty(), subject.orEmpty()).joinToString("\u0000")
        val id = MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).take(16)
            .joinToString("") { byte -> "%02x".format(byte) }
        return ProcessingDiagnostic(id, jobId, level, code, message, path, subject = subject)
    }

    private fun isExternal(value: String): Boolean = EXTERNAL_SCHEMES.any { value.startsWith(it, ignoreCase = true) }

    private companion object {
        const val DOCS_PATH = "docs.json"
        const val ASSETS_ROOT = "assets"
        const val MARKDOWN_FORMAT = "markdown"
        val EXTERNAL_SCHEMES = listOf("http://", "https://", "mailto:")
    }
}

private data object ValidationLimitExceeded : RuntimeException(null, null, false, false)

@Serializable
private data class ResolvedDocsInput(val navigation: List<NavigationNodeInput>)

@Serializable
private data class NavigationNodeInput(
    val title: String,
    val subjects: List<String>,
    val hidden: Boolean? = null,
    val items: List<NavigationNodeInput> = emptyList(),
    val path: String? = null,
    val contentFormat: String = "markdown",
    val contentRefs: List<ContentReferenceInput> = emptyList(),
)

@Serializable
private data class ContentReferenceInput(val source: ContentSourceInput, val path: String)

@Serializable
private enum class ContentSourceInput { Core, User }
