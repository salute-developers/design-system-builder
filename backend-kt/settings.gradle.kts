rootProject.name = "design-system-builder-backend"

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}
includeBuild("build-system")
includeBuild("project-publisher")
includeBuild("identity-gateway") {
    dependencySubstitution {
        substitute(module("com.dsbuilder.identity:feature-auth")).using(project(":feature-auth"))
    }
}
includeBuild("projects-service") {
    dependencySubstitution {
        substitute(module("com.dsbuilder.projects:core")).using(project(":core"))
        substitute(module("com.dsbuilder.projects:feature-projects")).using(project(":feature-projects"))
    }
}
includeBuild("documentation-service") {
    dependencySubstitution {
        substitute(module("com.dsbuilder.documentation:runtime")).using(project(":runtime"))
        substitute(module("com.dsbuilder.documentation:feature-ingestion")).using(project(":feature-ingestion"))
        substitute(module("com.dsbuilder.documentation:feature-processing")).using(project(":feature-processing"))
        substitute(module("com.dsbuilder.documentation:feature-publication")).using(project(":feature-publication"))
        substitute(module("com.dsbuilder.documentation:feature-search")).using(project(":feature-search"))
    }
}

include(":monolith:app")
