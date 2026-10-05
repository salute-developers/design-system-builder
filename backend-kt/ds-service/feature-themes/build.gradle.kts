plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

val generatedTokenValues = layout.buildDirectory.file("generated/resources/token-initial-values.json")
val tokenValuesDirectory = file("../../../js/services/db-service/src/db/seeds/prod/token_values")
val esbuild = file("../../../js/services/db-service/node_modules/esbuild/lib/main.js")
val tsx = file("../../../js/services/db-service/node_modules/.bin/tsx")

val generateTokenValues by tasks.registering {
    inputs.dir(tokenValuesDirectory)
    outputs.file(generatedTokenValues)
    doLast {
        check(tsx.canExecute()) { "db-service tsx is required to generate initial token values" }
        val script = """
            import fs from 'node:fs';
            import path from 'node:path';
            import esbuild from ${esbuild.absolutePath.quotedForJavaScript()};
            (async () => {
            const root = ${tokenValuesDirectory.absolutePath.quotedForJavaScript()};
            const sources = [
              ['color', 'color.ts'], ['gradient', 'gradient.ts'], ['fontFamily', 'fontFamily.ts'],
              ['shadow', 'shadow.ts'], ['shape', 'shape.ts'], ['typography', 'typography.ts'], ['spacing', 'spacing.ts'],
            ];
            const loadValues = async (file) => {
              const source = fs.readFileSync(path.join(root, file), 'utf8')
                .replace(/^import .*;\n/gm, '')
                .replace('const VALUES:', 'export const VALUES:');
              const code = (await esbuild.transform(source, { loader: 'ts', format: 'esm', target: 'es2022' })).code;
              return (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).VALUES;
            };
            const values = await Promise.all(sources.map(async ([type, file]) => [type, await loadValues(file)]));
            const rows = values.flatMap(([type, entries]) => Object.entries(entries).flatMap(([rawName, rawValue]) => {
              const isColor = type === 'color';
              const isModeAware = type === 'color' || type === 'gradient';
              const mode = isModeAware ? (rawName.startsWith('light.') ? 'light' : 'dark') : null;
              const name = isModeAware ? rawName.replace(/^(dark|light)\./, '') : rawName;
              const platforms = isColor ? ['web', 'ios', 'android'] : Object.keys(rawValue);
              const palette = isColor && typeof rawValue === 'string'
                ? rawValue.match(/^\[(\w+)\.(\w+)\.(\d+)\](?:\[([\d.]+)\])?$/)
                : null;
              return platforms.map((platform) => ({
                type, name, platform, mode,
                value: palette ? (palette[4] ? [palette[4]] : null) : (Array.isArray(isColor ? rawValue : rawValue[platform]) ? (isColor ? rawValue : rawValue[platform]) : [isColor ? rawValue : rawValue[platform]]),
                palette: palette ? { type: palette[1], shade: palette[2], saturation: Number(palette[3]) } : null,
              }));
            }));
            const paletteRows = ['general', 'additional'].flatMap((type) => {
              const data = JSON.parse(fs.readFileSync(path.join(root, '..', '..', 'data', type + '.json'), 'utf8'));
              return Object.entries(data).flatMap(([shade, saturations]) => Object.entries(saturations).map(([saturation, value]) => ({
                type, shade, saturation: Number(saturation), value,
              })));
            });
            console.log(JSON.stringify({ values: rows, palettes: paletteRows }));
            })();
        """.trimIndent()
        val process = ProcessBuilder(tsx.absolutePath, "-e", script).redirectErrorStream(false).start()
        val output = process.inputStream.bufferedReader().readText()
        val errors = process.errorStream.bufferedReader().readText()
        check(process.waitFor() == 0) { "Unable to generate initial token values: $errors" }
        generatedTokenValues.get().asFile.apply {
            parentFile.mkdirs()
            writeText(output)
        }
    }
}

sourceSets.main {
    resources.srcDir(generatedTokenValues.map { it.asFile.parentFile })
}

tasks.processResources {
    dependsOn(generateTokenValues)
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(project(":core"))
    implementation(libs.exposed.json)
    implementation(libs.postgresql.jdbc)

    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}

private fun String.quotedForJavaScript(): String =
    "'" + replace("\\", "\\\\").replace("'", "\\'") + "'"
