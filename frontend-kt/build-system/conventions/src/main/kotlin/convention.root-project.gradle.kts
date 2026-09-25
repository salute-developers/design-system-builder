plugins {
    id("base")
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://maven.pkg.jetbrains.space/kotlin/p/kotlin/kotlin-js-wrappers") }
    }
}

val detektAll = tasks.register("detektAll") {
    val includedTasks = gradle.includedBuilds.map {
        it.task(":detektAll")
    }
    dependsOn(includedTasks)
}

val spotlessCheckAll = tasks.register("spotlessCheckAll") {
    val includedTasks = gradle.includedBuilds.map {
        it.task(":spotlessCheckAll")
    }
    dependsOn(includedTasks)
}

val spotlessApplyAll = tasks.register("spotlessApplyAll") {
    val includedTasks = gradle.includedBuilds.map {
        it.task(":spotlessApplyAll")
    }
    dependsOn(includedTasks)
}

allprojects.forEach { project ->
    project.pluginManager.withPlugin("io.gitlab.arturbosch.detekt") {
        detektAll.configure {
            dependsOn("${project.path}:detekt")
        }
    }
    project.pluginManager.withPlugin("com.diffplug.spotless") {
        spotlessCheckAll.configure {
            dependsOn("${project.path}:spotlessCheck")
        }
        spotlessApplyAll.configure {
            dependsOn("${project.path}:spotlessApply")
        }
    }
}

tasks.register("mergeReports") {
    val includedMergeTasks = gradle
        .includedBuilds
        .map { it.task(":mergeReports") }
    dependsOn(includedMergeTasks)

    doLast {
        mergeReports("lint-results-debug.txt")
        mergeReports("detekt.txt")
    }
}

tasks.register("copyTestsReports") {
    val includedCopyTasks = gradle
        .includedBuilds
        .map { it.task(":copyTestsReports") }
    dependsOn(includedCopyTasks)
    finalizedBy("packageTestReports")

    doLast {
        subprojects.forEach {
            val reportDir = file("${it.projectDir.path}/build/reports/tests/")
            if (reportDir.exists()) {
                copyTestReportToRoot(it.name, reportDir)
            }
        }

        gradle.includedBuilds.forEach {
            val reportDir = file("${it.projectDir.path}/build/reports/tests/")
            if (reportDir.exists()) {
                copyTestReportToRoot(it.name, reportDir)
            }
        }
    }
}

tasks.register<Zip>("packageTestReports") {
    archiveFileName.set("test-reports.zip")
    destinationDirectory.set(layout.buildDirectory.dir("reports"))

    from(layout.buildDirectory.dir("reports/tests"))
}

fun copyTestReportToRoot(projectName: String, reportDir: File) {
    copy {
        val destination = layout.buildDirectory.dir("reports/tests/$projectName/")
        println("copying $reportDir to ${destination.get()}")
        from(reportDir)
        into(destination)
    }
}

fun mergeReports(fileName: String) {
    val subprojectsReports = subprojects.map {
        file("${it.projectDir.path}/build/reports/$fileName")
    }.filter { it.exists() }

    val includeBuildReports = gradle.includedBuilds.map {
        file("${it.projectDir.path}/build/reports/$fileName")
    }.filter { it.exists() }

    val allReports = files(subprojectsReports, includeBuildReports)
        .joinToString {
            val text = it.readText()
            if (text.isNotBlank()) {
                "${it.path}\n" + it.readText() + "\n\n"
            } else ""
        }
    val reportsDir = file("${projectDir.path}/build/reports/")
    file("${reportsDir.path}/$fileName").apply {
        if (!reportsDir.exists()) reportsDir.mkdirs()
        if (!exists()) createNewFile()
        writeText(allReports)
    }
}
