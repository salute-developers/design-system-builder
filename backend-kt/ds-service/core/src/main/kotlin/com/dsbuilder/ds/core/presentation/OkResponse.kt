package com.dsbuilder.ds.core.presentation

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

/** Stable delete response whose [ok] flag defaults to true. */
@Serializable
@OptIn(ExperimentalSerializationApi::class)
data class OkResponse(@EncodeDefault val ok: Boolean = true)
