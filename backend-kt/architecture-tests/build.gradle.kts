plugins {
    id("org.jetbrains.kotlin.jvm")
    id("convention.spotless")
}

dependencies {
    testImplementation(libs.konsist)
    testImplementation(libs.kotlin.test.junit)
}
