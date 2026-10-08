plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

// Эталон логики палитры темы общий с клиентом DS Builder: тесты домена читают его как ресурс.
tasks.processTestResources {
    from("../../../js/apps/client/src/modules/palette/fixtures") {
        include("palette-golden.json")
        into("palette")
    }
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(project(":core"))
    implementation(libs.exposed.json)
    implementation(libs.postgresql.jdbc)

    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}
