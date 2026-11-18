package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconAsset
import com.dsbuilder.ds.components.domain.IconEntry
import com.dsbuilder.ds.components.domain.IconHashing
import com.dsbuilder.ds.components.domain.IconNames
import com.dsbuilder.ds.components.domain.SvgSafety
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult

/** Проверка тела запроса загрузки. */
internal object IconCatalogUploadValidator {
    private const val MAX_SVG_BYTES = 64 * 1024
    private const val MAX_CATEGORY = 100
    private const val MAX_ALIASES = 40
    private const val MAX_ALIAS = 64
    private const val MAX_PACKAGE = 200

    fun prepare(command: PublishIconCatalog): DsResult<PreparedIconCatalog> {
        bodyProblem(command)?.let { return failure(PublishIconCatalogUseCase.INVALID_BODY, it) }
        val assets = command.icons.flatMap { icon -> icon.sizes.map { (size, svg) -> IconAsset(icon.name, size, svg) } }
        val entries = command.icons.map { it.toEntry() }
        return unsafeFailure(assets) ?: collisionFailure(entries) ?: entries.map {
            it.copy(contentHash = IconHashing.entryHash(it, assets))
        }.let { DsResult.Success(PreparedIconCatalog(it, assets, IconHashing.loadId(it))) }
    }

    private fun unsafeFailure(assets: List<IconAsset>): DsResult.Failure? = assets.firstNotNullOfOrNull { asset ->
        SvgSafety.check(asset.svg)?.let { reason ->
            failure(
                PublishIconCatalogUseCase.UNSAFE_SVG,
                "${asset.name} ${asset.size.px}: $reason",
                mapOf("name" to asset.name, "size" to asset.size.px.toString()),
            )
        }
    }

    private fun collisionFailure(entries: List<IconEntry>): DsResult.Failure? =
        entries.groupBy { it.legacyKey }.values.firstOrNull { it.size > 1 }?.let { group ->
            val names = group.joinToString { it.name }
            failure(
                PublishIconCatalogUseCase.LEGACY_KEY_COLLISION,
                "Ключ ${group.first().legacyKey} дают иконки: $names",
                mapOf("names" to names),
            )
        }

    private fun bodyProblem(command: PublishIconCatalog): String? {
        val names = command.icons.map { it.name }
        return when {
            listOf(command.packageName, command.packageVersion).any { it.isBlank() || it.length > MAX_PACKAGE } ->
                "Не задан пакет-источник"
            names.isEmpty() -> "Список иконок пуст"
            names.size != names.toSet().size -> "Имена иконок повторяются"
            else -> command.icons.firstNotNullOfOrNull(::iconProblem)
        }
    }

    private fun iconProblem(icon: IconUpload): String? = when {
        IconNames.parse(icon.name) == null -> "Недопустимое имя: ${icon.name.take(MAX_ALIAS)}"
        icon.sizes.isEmpty() || icon.sizes.values.any(::badSvg) -> "Недопустимые размеры или SVG: ${icon.name}"
        icon.category?.let { it.isBlank() || it.length > MAX_CATEGORY } == true ->
            "Недопустимая категория: ${icon.name}"
        icon.aliases.size > MAX_ALIASES || icon.aliases.any { it.isBlank() || it.length > MAX_ALIAS } ->
            "Недопустимые синонимы: ${icon.name}"
        else -> null
    }

    private fun badSvg(svg: String) = svg.isBlank() || svg.toByteArray(Charsets.UTF_8).size > MAX_SVG_BYTES

    private fun IconUpload.toEntry() = IconEntry(
        name = name,
        legacyKey = IconNames.legacyKeyOf(name),
        style = IconNames.styleOf(name),
        sizes = sizes.keys,
        category = category,
        aliases = aliases,
    )

    private fun failure(code: String, message: String, details: Map<String, String> = emptyMap()) =
        DsResult.Failure(DsFailure.InvalidRequest(code = code, details = details, message = message))
}
