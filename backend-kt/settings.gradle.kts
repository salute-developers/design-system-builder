rootProject.name = "design-system-builder-backend"

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}
includeBuild("build-system")
includeBuild("project-publisher")
includeBuild("identity-gateway")
includeBuild("projects-service")
includeBuild("documentation-service")
