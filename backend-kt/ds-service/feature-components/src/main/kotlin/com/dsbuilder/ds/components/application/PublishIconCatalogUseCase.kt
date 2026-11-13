package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.time.Instant

/**
 * Принимает каталог иконок, кладёт SVG в хранилище под идентификатор содержимого и одной транзакцией заменяет каталог,
 * пишет журнал и делает загрузку активной.
 *
 * Файлы неизменяемы и заливаются до транзакции: блокировка каталога и соединение не ждут медленное хранилище, откат
 * оставляет прежний каталог активным, а осиротевшие файлы убирает очистка по сроку. Использование иконок считается
 * после записи каталога: запись значения `icon`, начатая раньше, держит строки каталога и дописывается до этого.
 * Роль публикации проверяет маршрут до чтения тела.
 */
class PublishIconCatalogUseCase(
    private val transactions: TransactionRunner,
    private val storage: IconAssetStorage,
    private val catalog: IconCatalogRepository,
    private val usage: IconUsageReader,
    private val settings: IconCatalogSettings,
) {
    /** Выполняет загрузку каталога. */
    @Suppress("ReturnCount")
    suspend fun execute(context: DsRequestContext, command: PublishIconCatalog): DsResult<PublishIconCatalogResult> {
        if (!storage.configured) return DsResult.Failure(DsFailure.DependencyUnavailable(STORAGE_DEPENDENCY))
        val prepared = when (val result = IconCatalogUploadValidator.prepare(command)) {
            is DsResult.Failure -> return result
            is DsResult.Success -> result.value
        }
        if (command.dryRun) return transactions.readOnly { DsResult.Success(preview(prepared)) }
        if (!isStored(prepared.loadId) && !upload(prepared)) {
            return DsResult.Failure(DsFailure.DependencyUnavailable(STORAGE_DEPENDENCY))
        }
        val written = transactions.required {
            catalog.lockPublications()
            activate(context, command, prepared)
        }
        if (written is DsResult.Success && written.value.outcome != IconPublishOutcome.UNCHANGED) cleanup()
        return written
    }

    /**
     * Загрузка полностью лежит в хранилище, только если у неё есть строка журнала: строка пишется после заливки всех
     * файлов. Наличие хотя бы одного файла ничего не значит: заливка могла прерваться на середине, и такие файлы
     * дозаливаются повторно (ключи неизменяемы, `put` идемпотентен).
     */
    private suspend fun isStored(loadId: IconCatalogLoadId) =
        transactions.readOnly { DsResult.Success(catalog.loadsByRecency().any { it.loadId == loadId }) }.let {
            (it as DsResult.Success).value
        }

    private suspend fun preview(prepared: PreparedIconCatalog): PublishIconCatalogResult {
        val old = catalog.entries()
        return describe(outcomeOf(prepared), old, prepared, usage.usedValues(), dryRun = true)
    }

    /** Заменяет каталог и только затем считает использование: параллельная запись значения успевает завершиться. */
    private suspend fun activate(
        context: DsRequestContext,
        command: PublishIconCatalog,
        prepared: PreparedIconCatalog,
    ): DsResult<PublishIconCatalogResult> {
        val old = catalog.entries()
        val outcome = outcomeOf(prepared)
        if (outcome != IconPublishOutcome.UNCHANGED) {
            val actor = context.principal.actorId
            catalog.replaceActive(
                prepared.entries,
                NewIconCatalogLoad(prepared.loadId, command.packageName, command.packageVersion, actor),
            )
        }
        val result = describe(outcome, old, prepared, usage.usedValues(), dryRun = false)
        return if (result.removedInUse.isEmpty() || command.allowRemovingUsed) {
            DsResult.Success(result)
        } else {
            DsResult.Failure(inUse(result.removedInUse))
        }
    }

    private suspend fun outcomeOf(prepared: PreparedIconCatalog): IconPublishOutcome {
        val known = catalog.loadsByRecency().firstOrNull { it.loadId == prepared.loadId }
        return when {
            known == null -> IconPublishOutcome.PUBLISHED
            known.active -> IconPublishOutcome.UNCHANGED
            else -> IconPublishOutcome.ACTIVATED
        }
    }

    private fun describe(
        outcome: IconPublishOutcome,
        old: List<com.dsbuilder.ds.components.domain.IconEntry>,
        prepared: PreparedIconCatalog,
        used: Map<String, Int>,
        dryRun: Boolean,
    ) = PublishIconCatalogResult(
        outcome = outcome,
        dryRun = dryRun,
        loadId = prepared.loadId.value,
        diff = IconCatalogDiffer.diff(old, prepared.entries),
        removedInUse = IconCatalogDiffer.removedInUse(old, prepared.entries, used),
        reconciliation = IconCatalogDiffer.reconcile(prepared.entries, used),
    )

    /** Заливает SVG ограниченным параллелизмом: каталог состоит из тысяч небольших объектов. */
    private suspend fun upload(prepared: PreparedIconCatalog): Boolean = attempt {
        val permits = Semaphore(UPLOAD_PARALLELISM)
        coroutineScope {
            prepared.assets.map { asset -> async { permits.withPermit { storage.put(prepared.loadId, asset) } } }
                .awaitAll()
        }
    }

    /** Выполняет [block], превращая сбой хранилища в `false`; отмену корутины пробрасывает. */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun attempt(block: suspend () -> Unit): Boolean = try {
        block()
        true
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        false
    }

    private fun inUse(removed: List<RemovedIconInUse>): DsFailure {
        val shown = removed.take(MAX_REPORTED_IN_USE).joinToString("; ") {
            "${it.name} (${it.sizes.joinToString(",")}): ${it.references}"
        }
        return DsFailure.Conflict(
            code = ICONS_IN_USE,
            message = "Удаляются используемые иконки: $shown" + " (всего ${removed.size})",
        )
    }

    /**
     * Оставляет активную загрузку и [IconCatalogSettings.keepLoads] предыдущих: строки лишних загрузок снимаются под
     * блокировкой. Файлы удаляются только когда у загрузки нет строки и они старше срока ожидания, поэтому
     * параллельная публикация, заливающая или активирующая загрузку, не теряет файлы. Ошибки не влияют на результат.
     */
    private suspend fun cleanup() {
        attempt {
            transactions.required {
                catalog.lockPublications()
                catalog.loadsByRecency().filter { !it.active }.drop(settings.keepLoads).forEach {
                    catalog.deleteLoad(it.loadId)
                }
                DsResult.Success(Unit)
            }
            val rows = transactions.readOnly {
                DsResult.Success(catalog.loadsByRecency().map { it.loadId.value }.toSet())
            }.let { (it as DsResult.Success).value }
            val threshold = Instant.now().minus(settings.orphanGrace)
            storage.listLoads().filter { it.lastModified.isBefore(threshold) && it.loadId !in rows }
                .forEach { storage.deleteLoad(it.loadId) }
        }
    }

    /** Константы загрузки. */
    companion object {
        /** Код конфликта: удаляются иконки, на которые есть ссылки. */
        const val ICONS_IN_USE = "icons_in_use"

        /** Код отказа для некорректного тела. */
        const val INVALID_BODY = "invalid_body"

        /** Код отказа: в SVG есть недопустимое содержимое. */
        const val UNSAFE_SVG = "unsafe_svg"

        /** Код отказа: две иконки дают один ключ старого формата. */
        const val LEGACY_KEY_COLLISION = "legacy_key_collision"

        /** Имя недоступной зависимости: хранилище SVG. */
        const val STORAGE_DEPENDENCY = "icon-storage"

        private const val UPLOAD_PARALLELISM = 16
        private const val MAX_REPORTED_IN_USE = 20
    }
}
