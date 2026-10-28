plugins {
    id("convention.root-project")
    alias(libs.plugins.kotlin.jvm)
    id("convention.detekt")
    id("convention.spotless")
}
group = "com.dsbuilder.runtime"
version = "1.0.0"
dependencies { testImplementation(libs.kotlin.test.junit) }
