package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.domain.LegacyIconValue
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Проверка значения свойства типа `icon` по активному каталогу при записи из редактора.
 *
 * Работает в транзакции записи. Без активного каталога, при очистке и при записи значения, равного сохранённому,
 * значение принимается; остальные значения должны быть в каталоге со своим размером.
 */
internal object IconValueGuard {
    /** Код отказа: значения нет в каталоге. */
    const val UNKNOWN_ICON = "unknown_icon"

    /**
     * Проверяет [value] свойства [propertyId], если оно имеет тип `icon`; [current] — сохранённое значение. Значение
     * ссылки на токен ([tokenId] задан) и не переданное в запросе ([present] равно `false`) не проверяется.
     */
    fun check(propertyId: UUID, tokenId: UUID?, value: String?, current: String?, present: Boolean = true) {
        val candidate = value?.takeIf { present && tokenId == null && it.isNotEmpty() && it != current } ?: return
        val isIcon = PropertiesTable.selectAll()
            .where { (PropertiesTable.id eq propertyId) and (PropertiesTable.type eq PropertyTypeDb.ICON) }.any()
        if (isIcon) verify(candidate)
    }

    /**
     * Строки каталога читаются с `FOR SHARE`: публикация, заменившая каталог после снимка записи значения, даёт сбой
     * сериализации и запись повторяется по новому каталогу, а публикация ждёт уже начатую запись и затем видит её
     * значение в использовании.
     */
    private fun verify(value: String) {
        val share = ForUpdateOption.PostgreSQL.ForShare
        if (IconCatalogLoadsTable.selectAll().where { IconCatalogLoadsTable.active eq true }.forUpdate(share).empty()) {
            return
        }
        val unknown = EditorRuleViolationException(UNKNOWN_ICON, "Иконка не найдена в каталоге", invalid = true)
        val (key, size) = LegacyIconValue.parse(value) ?: throw unknown
        val icons = IconsTable.selectAll().where { IconsTable.legacyKey inList LegacyIconValue.candidates(key) }
            .forUpdate(share).toList()
        val icon = icons.firstOrNull { it[IconsTable.legacyKey] == key } ?: icons.firstOrNull()
        if (icon?.get(IconsTable.sizes)?.contains(size.px) != true) throw unknown
    }
}
