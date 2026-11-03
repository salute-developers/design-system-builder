package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import java.util.UUID

/**
 * Хранилище стилей типографии темы поверх предметных редакций; вызывается внутри транзакции use case. Чтение
 * разрешает редакции на границе транзакции: выбранной опубликованной версии или активного черновика.
 */
interface TypographyStyleRepository {
    /** Тема проекта на выбранной границе или `null`, если её нет или она принадлежит другому проекту. */
    suspend fun tenant(projectId: ProjectId, tenantId: UUID): TypographyTenant?

    /** Берёт разделяемую блокировку дизайн-системы темы проекта, согласуя запись с публикацией. */
    suspend fun lock(projectId: ProjectId, tenantId: UUID): TypographyStyleLock

    /** Токен дизайн-системы [designSystemId] по идентификатору. */
    suspend fun token(designSystemId: UUID, tokenId: UUID): TypographyTokenLookup

    /**
     * Токены стилей дизайн-системы со значениями темы [tenantId] и их техническими редакциями; при [style] —
     * только токены этого стиля на всех экранах. Токены с именем вне правила стиля в ответ не попадают.
     */
    suspend fun styles(
        designSystemId: UUID,
        tenantId: UUID,
        style: TypographyStyleKey? = null,
    ): List<StoredTypographyToken>

    /**
     * Блокирует технические состояния значений стиля [style] темы [tenantId] в устойчивом порядке и перечитывает
     * их: изменение строится от актуального содержимого, а не от состояния до блокировки.
     */
    suspend fun lockStyle(designSystemId: UUID, tenantId: UUID, style: TypographyStyleKey): List<StoredTypographyToken>

    /** Семейства шрифтов дизайн-системы с именем шрифта в теме [tenantId]. */
    suspend fun families(designSystemId: UUID, tenantId: UUID): List<TypographyFamily>

    /** Число тем дизайн-системы. */
    suspend fun themeCount(designSystemId: UUID): Int

    /** Записывает новые редакции значений активного черновика с путём `/value`; остальные значения не меняются. */
    suspend fun writeValues(designSystemId: UUID, values: List<TypographyValueWrite>)

    /** Имена действующих токенов дизайн-системы любого типа в нижнем регистре: проверка занятого имени. */
    suspend fun tokenNames(designSystemId: UUID): Set<String>

    /**
     * Создаёт токены стиля: новое имя → токен-источник, значения которого во всех темах копируются в новый токен;
     * при [family] семейство в скопированных значениях заменяется на `fontFamily.<family>`. Определения — по правилу
     * сида. Результат — новое имя → идентификатор.
     */
    suspend fun createStyle(
        designSystemId: UUID,
        sources: Map<TypographyTokenName, UUID>,
        family: String? = null,
    ): Map<TypographyTokenName, UUID>

    /**
     * Переименовывает токены стиля [names] (идентификатор → новое имя) с отображаемым именем и описанием по правилу
     * сида; перед этим привязывает по `token_id` текстовые ссылки компонентов [references] (токен → строки значений).
     */
    suspend fun renameStyle(
        designSystemId: UUID,
        names: Map<UUID, TypographyTokenName>,
        references: Map<UUID, Set<UUID>>,
    )

    /**
     * Логически удаляет токены стиля [tokenIds] со значениями во всех темах; текстовые ссылки компонентов
     * [references] и ссылки комбинаций стилей по `token_id` (их текст повторяет имя стиля) становятся пустыми, как и
     * остальные ссылки по `token_id` на удаляемые токены.
     */
    suspend fun deleteStyle(designSystemId: UUID, tokenIds: Set<UUID>, references: Map<UUID, Set<UUID>>)
}
