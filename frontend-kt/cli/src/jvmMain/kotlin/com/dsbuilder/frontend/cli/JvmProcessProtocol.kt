package com.dsbuilder.frontend.cli

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.net.URLClassLoader
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption.REPLACE_EXISTING
import java.nio.file.attribute.PosixFilePermission
import java.util.jar.Attributes
import java.util.jar.JarOutputStream
import java.util.jar.Manifest

@Serializable
internal data class JvmProcessRequest(
    val executable: String,
    val args: List<String>,
    val environment: Map<String, String>,
    val inheritStdio: Boolean,
)

/** Private files coordinate launch, exit and output without consuming tool stdin. */
internal object JvmProcessProtocol {
    fun write(directory: Path, name: String, value: String) {
        val temporary = directory.resolve(".$name.tmp")
        Files.writeString(temporary, value)
        if (Files.getFileStore(temporary).supportsFileAttributeView("posix")) {
            Files.setPosixFilePermissions(
                temporary,
                setOf(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE),
            )
        }
        Files.move(temporary, directory.resolve(name), REPLACE_EXISTING)
    }

    fun classpathJar(directory: Path): Path {
        val entries = linkedSetOf<String>()
        System.getProperty("java.class.path").split(File.pathSeparator).forEach {
            entries += File(it).absoluteFile.toURI().toASCIIString()
        }
        // Gradle test workers keep application classes in a separate URLClassLoader.
        var loader: ClassLoader? = JvmProcessSupervisor::class.java.classLoader
        while (loader != null) {
            (loader as? URLClassLoader)?.getURLs()?.filter { it.protocol == "file" }?.forEach {
                entries += it.toURI().toASCIIString()
            }
            loader = loader.parent
        }
        val manifest = Manifest().also {
            it.mainAttributes[Attributes.Name.MANIFEST_VERSION] = "1.0"
            it.mainAttributes[Attributes.Name.CLASS_PATH] = entries.joinToString(" ")
        }
        val jar = directory.resolve("classpath.jar")
        JarOutputStream(Files.newOutputStream(jar), manifest).use { }
        return jar
    }

    fun writeRequest(directory: Path, request: JvmProcessRequest) =
        write(directory, "request", Json.encodeToString(JvmProcessRequest.serializer(), request))

    fun readRequest(directory: Path): JvmProcessRequest =
        Json.decodeFromString(JvmProcessRequest.serializer(), Files.readString(directory.resolve("request")))
}
