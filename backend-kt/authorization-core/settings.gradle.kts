pluginManagement {
    repositories { mavenCentral(); gradlePluginPortal() }
}

dependencyResolutionManagement {
    repositories { mavenCentral() }
    versionCatalogs { create("libs") { from(files("../gradle/libs.versions.toml")) } }
}

rootProject.name = "authorization-core"
includeBuild("../build-system")
