## 1. Build-system conventions

- [x] 1.1 Add Kotlin Multiplatform Gradle plugin coordinates to the shared version catalog if they are missing.
- [x] 1.2 Add the Kotlin Multiplatform Gradle plugin dependency to `build-system/conventions/build.gradle.kts`.
- [x] 1.3 Create `build-system/conventions/src/main/kotlin/convention.kotlin-multiplatform-module.gradle.kts`.
- [x] 1.4 Configure the new convention to apply `org.jetbrains.kotlin.multiplatform`, `convention.detekt`, and `convention.spotless`.
- [x] 1.5 Configure the convention with a JVM target and minimal `commonMain`/`commonTest` baseline dependencies without Ktor, Exposed, Docker, Compose Desktop, or backend SDK dependencies.

## 2. Frontend Gradle setup

- [x] 2.1 Update `dsbuilder-frontend/settings.gradle.kts` to include `build-system` through `pluginManagement.includeBuild("../build-system")` or the equivalent local convention resolution.
- [x] 2.2 Replace active frontend modules with only `include(":cli")`.
- [x] 2.3 Update `dsbuilder-frontend/build.gradle.kts` to use shared root, Detekt, and Spotless conventions instead of Compose Desktop plugin aliases.
- [x] 2.4 Update `dsbuilder-frontend/gradle/libs.versions.toml` so Kotlin and test dependencies are compatible with the shared convention setup.

## 3. CLI module

- [x] 3.1 Create `dsbuilder-frontend/cli/build.gradle.kts` and apply `convention.kotlin-multiplatform-module`.
- [x] 3.2 Configure the CLI module JVM application entrypoint with application name `dsbuilder` and a main class under `com.dsbuilder.frontend.cli`.
- [x] 3.3 Add shared CLI behavior in `commonMain` that returns deterministic baseline output for default/help/version-style invocation.
- [x] 3.4 Add the JVM `main` function in `jvmMain` that delegates to shared CLI behavior and prints the result.
- [x] 3.5 Add `commonTest` coverage for baseline CLI behavior.
- [x] 3.6 Add Russian KDoc for public CLI classes, functions, and properties introduced by the module.

## 4. Remove obsolete frontend modules

- [x] 4.1 Remove `dsbuilder-frontend/desktopApp` from the active codebase for this change.
- [x] 4.2 Remove `dsbuilder-frontend/shared` from the active codebase for this change.
- [x] 4.3 Remove obsolete Compose Desktop and shared-module dependencies from frontend build scripts and version catalog unless still required by the new CLI setup.

## 5. Verification

- [x] 5.1 Run `cd build-system && ./gradlew build` and fix convention compilation issues.
- [x] 5.2 Run `cd dsbuilder-frontend && ./gradlew build`.
- [x] 5.3 Run `cd dsbuilder-frontend && ./gradlew test`.
- [x] 5.4 Run `cd dsbuilder-frontend && ./gradlew detekt`.
- [x] 5.5 Run `cd dsbuilder-frontend && ./gradlew spotlessCheck`.
- [x] 5.6 If `spotlessCheck` fails only because changed files need formatting, run `cd dsbuilder-frontend && ./gradlew spotlessApply`, inspect the diff, and repeat verification.
