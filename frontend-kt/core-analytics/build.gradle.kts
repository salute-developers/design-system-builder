plugins {
    id("convention.kotlin-multiplatform-node-library")
}

kotlin {
    macosArm64()
    macosX64()
    mingwX64()
    sourceSets.commonTest.dependencies { implementation(libs.kotlinx.coroutines.test) }
}
