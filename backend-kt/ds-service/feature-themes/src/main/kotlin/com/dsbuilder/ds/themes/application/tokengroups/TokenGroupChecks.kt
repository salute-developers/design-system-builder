package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.ds.core.application.DsFailure

internal const val INVALID_TOKEN_GROUP = "INVALID_TOKEN_GROUP"
internal const val TOKEN_GROUP_CONFLICT = "TOKEN_GROUP_CONFLICT"

/** Отказ с кодом [INVALID_TOKEN_GROUP]. */
internal fun invalidTokenGroup(message: String) = DsFailure.InvalidRequest(INVALID_TOKEN_GROUP, message = message)

/** Отказ с кодом [TOKEN_GROUP_CONFLICT]. */
internal fun tokenGroupConflict(label: String) =
    DsFailure.Conflict(TOKEN_GROUP_CONFLICT, message = "Группа «${label.trim()}» уже есть на этом уровне")
