package com.dsbuilder.ds.components

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.components.application.modelDelete
import com.dsbuilder.ds.components.application.modelFind
import com.dsbuilder.ds.components.application.modelFindList
import com.dsbuilder.ds.components.application.modelList
import com.dsbuilder.ds.components.application.modelMutate
import com.dsbuilder.ds.components.application.systemAdminDelete
import com.dsbuilder.ds.components.application.systemAdminMutate
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Shared behavioral contract used by every component-model use case. */
class ComponentModelUseCaseSupportTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()

    @Test
    fun `find and mutate conceal missing owned resources`() = runBlocking {
        val missing = modelFind(policy, transactions, adminContext()) { null as String? }
        val mutation = modelMutate(policy, transactions, adminContext()) { null as String? }
        val deletion = modelDelete(policy, transactions, adminContext()) { false }

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(missing).error)
        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(mutation).error)
        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(deletion).error)
    }

    @Test
    fun `find list returns empty only for system administrators`() = runBlocking {
        val hidden = modelFindList<String>(policy, transactions, viewerContext()) { null }
        val admin = modelFindList<String>(policy, transactions, adminContext()) { null }

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(hidden).error)
        assertEquals(emptyList(), assertIs<DsResult.Success<List<String>>>(admin).value)
    }

    @Test
    fun `list reads in read-only transaction and mutation uses required transaction`() = runBlocking {
        val trackingTransactions = TrackingTransactions()

        assertEquals(
            listOf("component"),
            assertIs<DsResult.Success<List<String>>>(
                modelList(policy, trackingTransactions, viewerContext()) { listOf("component") },
            ).value,
        )
        assertEquals(
            "component",
            assertIs<DsResult.Success<String>>(
                modelMutate(policy, trackingTransactions, adminContext()) { "component" },
            ).value,
        )
        assertEquals(1, trackingTransactions.readOnlyCalls)
        assertEquals(1, trackingTransactions.requiredCalls)
    }

    @Test
    fun `system admin operations reject project users and preserve missing semantics`() = runBlocking {
        val userMutation = systemAdminMutate(policy, transactions, viewerContext()) { "state" }
        val userDeletion = systemAdminDelete(policy, transactions, viewerContext()) { true }
        val missing = systemAdminMutate(policy, transactions, adminContext()) { null as String? }

        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(userMutation).error)
        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(userDeletion).error)
        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(missing).error)
    }

    private fun viewerContext() = context("viewer", false)

    private fun adminContext() = context("system_admin", true)

    private fun context(role: String, systemAdmin: Boolean) = DsRequestContext(
        ProjectPrincipal(
            ProjectActorType.USER,
            "user-1",
            "project-1",
            projectRole = if (systemAdmin) null else role,
            systemAdmin = systemAdmin,
        ),
        "correlation-1",
    )

    private class ImmediateTransactions : TransactionRunner {
        override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()

        override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
    }

    private class TrackingTransactions : TransactionRunner {
        var requiredCalls = 0
        var readOnlyCalls = 0

        override suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T> {
            requiredCalls += 1
            return block()
        }

        override suspend fun <T> readOnly(block: suspend () -> DsResult<T>): DsResult<T> {
            readOnlyCalls += 1
            return block()
        }
    }
}
