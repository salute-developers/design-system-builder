rootProject.name = "design-system-builder-kt"

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}
includeBuild("build-system")
includeBuild("project-publisher")
