package com.dsbuilder.feature.publisher.application

internal interface TransactionManager {
    suspend fun <T> required(block: TransactionWrapper.() -> T): T
}

internal interface TransactionWrapper {

    fun rollback()
}
