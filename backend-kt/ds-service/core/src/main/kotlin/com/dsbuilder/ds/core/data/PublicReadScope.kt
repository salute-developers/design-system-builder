package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.Key
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

internal val publicReadScopeKey = Key<Boolean>()

/** Предметные SQL-проекции сужаются только внутри подготовленной публичной транзакции. */
fun isPublicReadScope(): Boolean = TransactionManager.current().getUserData(publicReadScopeKey) == true
