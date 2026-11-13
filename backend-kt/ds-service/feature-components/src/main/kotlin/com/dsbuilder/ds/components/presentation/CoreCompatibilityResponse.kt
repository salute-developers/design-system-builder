package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.core.application.CoreCompatibilityIssue
import com.dsbuilder.ds.core.application.CoreCompatibilityReport
import com.dsbuilder.ds.core.application.ModelReadContext
import kotlinx.serialization.Serializable

/** Публичный отчёт; UUID преобразуются в строки только на HTTP-границе. */
@Serializable
data class CoreCompatibilityResponse(
    /** Фактические Core и предметная граница проверки. */
    val context: Context,
    /** Проблемы текущей страницы после фильтрации. */
    val items: List<Issue>,
    /** Общее число блокирующих проблем всей ДС, до фильтрации. */
    val blockingCount: Int,
    /** Общее число предупреждений всей ДС, до фильтрации. */
    val warningCount: Int,
    /** Версия правил проверки, включённая в контекст курсора. */
    val validatorVersion: Int,
    /** Продолжение страницы, связанное с Core, редакцией и фильтром. */
    val nextCursor: String?,
) {
    /** Контекст, участвующий в ключе кеша клиента. */
    @Serializable
    data class Context(
        /** Дизайн-система, доступ к которой проверен сервером. */
        val designSystemId: String,
        /** Опубликованная граница; null при чтении черновика. */
        val versionId: String?,
        /** Выбранный черновик; null для опубликованной версии. */
        val draftId: String?,
        /** Редакция черновика, согласованная с Core при чтении. */
        val draftRevision: Long?,
        /** Согласованный набор снимков Core выбранной границы. */
        val coreReleases: List<Release>,
    )

    /** Проверенное происхождение релиза либо явно обозначенный технический снимок. */
    @Serializable
    data class Release(
        /** Идентификатор неизменяемого серверного снимка. */
        val releaseId: String,
        /** Стабильное имя библиотеки Core. */
        val libraryId: String,
        /** Платформа каталога: web, compose, xml или ios. */
        val platform: String,
        /** Версия Core, явно переданная производителем. */
        val version: String,
        /** SHA-256 исходных байтов; неизвестен у технического снимка миграции. */
        val metaSha256: String?,
        /** imported либо migration-snapshot; последнее не доказывает историческую версию. */
        val provenance: String,
    )

    /** Адрес и доступные действия одной проблемы. */
    @Serializable
    data class Issue(
        /** Стабильный ID проблемы, независимый от страницы и фильтра. */
        val issueId: String,
        /** Машиночитаемая причина проблемы. */
        val code: String,
        /** blocking запрещает публикацию и экспорт; warning только предупреждает. */
        val severity: String,
        /** Точное расположение назначения в выбранной границе. */
        val location: Location,
        /** Исходные данные назначения; null для проблемы компонента целиком. */
        val storedValue: Value?,
        /** Допустимые действия; пусто для исторической границы. */
        val allowedActions: List<String>,
    )

    /** Полный адрес назначения, включая базу или сочетание стилей. */
    @Serializable
    data class Location(
        /** Устойчивый ID компонента. */
        val componentId: String,
        /** Диагностическое имя, доступное и после удаления из Core. */
        val componentName: String,
        /** Платформа для точного перехода из сводки. */
        val platform: String,
        /** ID оформления; отсутствует у проблемы компонента целиком. */
        val appearanceId: String?,
        /** Название сохранённого оформления. */
        val appearanceName: String?,
        /** Устойчивый ID свойства, включая исчезнувшее из Core. */
        val propertyId: String?,
        /** Диагностическое имя свойства. */
        val propertyName: String?,
        /** Область назначения: invariant, variation или combination. */
        val valueKind: String?,
        /** ID сохранённого назначения для исправления. */
        val valueId: String?,
        /** ID значений вариаций, задающих область назначения. */
        val styleIds: List<String>,
        /** Подписи осей и значений для точного перехода в редактор. */
        val styleLabels: List<String>,
        /** Названия системных и компонентных состояний назначения. */
        val states: List<String>,
        /** Предметная ревизия для optimistic concurrency; null для исходного значения. */
        val revision: Long?,
    )

    /** Исходная настройка без вычисления старого значения токена. */
    @Serializable
    data class Value(
        /** Исходный литерал без фильтрации несовместимых данных. */
        val literal: String?,
        /** ID назначенного токена. */
        val tokenId: String?,
        /** Диагностическое имя назначенного токена. */
        val tokenName: String?,
        /** Сохранённая прозрачность. */
        val alpha: String?,
        /** Сохранённая общая поправка значения. */
        val adjustment: String?,
        /** ID явно выбранного вложенного оформления. */
        val targetAppearanceId: String?,
        /** Стили вложенного оформления, выбранные в настройках ДС. */
        val targetStyleIds: List<String>,
        /** Отдельные платформенные поправки, запрещающие автоматический перенос. */
        val platformAdjustments: List<Adjustment>,
    )

    /** Самостоятельная поправка с её редакцией и шаблоном. */
    @Serializable
    data class Adjustment(
        /** Устойчивый ID платформенной поправки. */
        val id: String,
        /** ID параметра платформы, к которому относится поправка. */
        val platformParamId: String,
        /** Предметная ревизия для optimistic concurrency; null для исходного значения. */
        val revision: Long?,
        /** Сохранённое смещение или литерал поправки. */
        val value: String?,
        /** Сохранённый шаблон поправки. */
        val template: String?,
    )

    companion object {
        /** Создаёт DTO без сериализации внутренних моделей напрямую. */
        fun from(report: CoreCompatibilityReport) = CoreCompatibilityResponse(
            context(report.context),
            report.items.map(::issue),
            report.blockingCount,
            report.warningCount,
            report.validatorVersion,
            report.nextCursor,
        )

        private fun context(c: ModelReadContext) = Context(
            c.designSystemId.toString(),
            c.versionId?.toString(),
            c.draftId?.toString(),
            c.draftRevision,
            c.coreReleases.map { r ->
                Release(
                    r.releaseId.toString(),
                    r.ref.libraryId,
                    r.ref.platform,
                    r.ref.version,
                    r.metaSha256,
                    r.provenance,
                )
            },
        )

        private fun issue(i: CoreCompatibilityIssue): Issue {
            val l = i.location
            return Issue(
                i.issueId,
                i.code,
                i.severity,
                Location(
                    l.componentId.toString(), l.componentName, l.platform, l.appearanceId?.toString(), l.appearanceName,
                    l.propertyId?.toString(), l.propertyName, l.valueKind, l.valueId?.toString(),
                    l.styleIds.map { it.toString() }, l.styleLabels, l.states, l.revision,
                ),
                i.storedValue?.let { v ->
                    Value(
                        v.literal,
                        v.tokenId?.toString(),
                        v.tokenName,
                        v.alpha,
                        v.adjustment,
                        v.targetAppearanceId?.toString(),
                        v.targetStyleIds.map { it.toString() },
                        v.platformAdjustments.map { a ->
                            Adjustment(
                                a.id.toString(),
                                a.platformParamId.toString(),
                                a.revision,
                                a.value,
                                a.template,
                            )
                        },
                    )
                },
                i.allowedActions,
            )
        }
    }
}
