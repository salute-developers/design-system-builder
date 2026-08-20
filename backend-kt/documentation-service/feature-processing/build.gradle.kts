plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation(project(":feature-ingestion"))
    implementation(project(":feature-publication"))
    implementation(libs.commonmark)
    implementation(libs.commonmark.gfm.tables)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.commons.compress)
    implementation(libs.aws.s3)
    implementation(libs.exposed.json)
    testImplementation(libs.kotlin.test.junit)
}
