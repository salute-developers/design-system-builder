package com.dsbuilder.frontend.runtime.node

/** Windows treats environment names as case-insensitive, unlike POSIX. */
internal fun nodeProcessEnvironment(inherited: dynamic, overrides: Map<String, String>, windows: Boolean): dynamic {
    val environment: dynamic = js("Object.assign({}, inherited)")
    overrides.forEach { (key, value) ->
        if (windows) {
            (js("Object.keys(environment)") as Array<String>).filter { it.equals(key, true) }
                .forEach { js("Reflect").deleteProperty(environment, it) }
        }
        environment[key] = value
    }
    (js("Object.keys(environment)") as Array<String>).filter {
        it.startsWith("DSBUILDER_METRICA_", ignoreCase = true)
    }.forEach { js("Reflect").deleteProperty(environment, it) }
    return environment
}
