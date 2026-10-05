package com.dsbuilder.ds.tokens.data

import org.jetbrains.exposed.v1.core.Table
import org.postgresql.util.PGobject

/** Maps a PostgreSQL enum to its domain enum without falling back to varchar parameters. */
internal fun <T : Enum<T>> Table.postgresEnum(
    name: String,
    sqlType: String,
    fromWire: (String) -> T?,
    toWire: (T) -> String,
) = customEnumeration(
    name,
    sqlType,
    { value -> requireNotNull(fromWire(value.toString())) },
    { value ->
        PGobject().apply {
            type = sqlType
            this.value = toWire(value)
        }
    },
)
