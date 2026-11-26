package com.dsbuilder.ds.core.application

/** Явное согласие политики на доказанное предметное исключение до получения подробностей. */
interface JournalCandidateExclusionPolicy {
    /** Поддерживает ли политика правило с устойчивым предметным идентификатором [exclusion]. */
    fun permits(exclusion: String): Boolean
}
