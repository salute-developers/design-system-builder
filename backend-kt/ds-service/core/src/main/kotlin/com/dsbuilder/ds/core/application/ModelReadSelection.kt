package com.dsbuilder.ds.core.application

import java.util.UUID

/** Выбор границы чтения без зависимости от HTTP и хранилища. */
sealed interface ModelReadSelection {
    /** Активный черновик ресурса. */
    data object Draft : ModelReadSelection

    /** Точный номер опубликованной версии ресурса.
     * @property version Номер опубликованной версии.
     */
    data class Published(val version: String) : ModelReadSelection

    /** Существующий UUID опубликованной версии.
     * @property id Идентификатор опубликованной версии.
     */
    data class ById(val id: UUID) : ModelReadSelection

    companion object {
        /** Отклоняет повтор параметров, конфликт селекторов и неточные номера. */
        fun parse(versions: List<String>, versionIds: List<String>): DsResult<ModelReadSelection> {
            val repeated = versions.size > 1 || versionIds.size > 1
            val conflicting = versions.isNotEmpty() && versionIds.isNotEmpty()
            if (repeated || conflicting) {
                return invalidSelection()
            }
            val version = versions.singleOrNull()
            val id = versionIds.singleOrNull()
            return when {
                id != null -> runCatching { UUID.fromString(id) }.getOrNull()
                    ?.takeIf { it.toString().equals(id, ignoreCase = true) }
                    ?.let { DsResult.Success(ById(it)) } ?: invalidSelection()
                version == null || version == "draft" -> DsResult.Success(Draft)
                VERSION_PATTERN.matches(version) -> DsResult.Success(Published(version))
                else -> invalidSelection()
            }
        }

        private val VERSION_PATTERN = Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)")

        private fun invalidSelection() = DsResult.Failure(DsFailure.InvalidRequest("INVALID_QUERY"))
    }
}
