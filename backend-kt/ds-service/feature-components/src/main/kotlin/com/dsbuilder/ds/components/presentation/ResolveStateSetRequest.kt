package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for canonical state-set resolution. */
@Serializable
data class ResolveStateSetRequest(/** State ids carried by this contract. */ val stateIds: List<String>)
