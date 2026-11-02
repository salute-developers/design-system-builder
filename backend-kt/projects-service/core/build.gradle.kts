plugins {
    id("convention.core-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies { implementation(libs.hikari) }
