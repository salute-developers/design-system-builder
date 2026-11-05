package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.typography.TypographyScreenView
import java.util.UUID

/** Созданный стиль: идентификаторы девяти токенов и стиль на каждом экране в формате чтения. */
data class CreatedTypographyStyle(
    /** Идентификаторы токенов стиля. */
    val tokenIds: List<UUID>,
    /** Экраны с одним новым стилем; компонентов у нового стиля нет. */
    val screens: List<TypographyScreenView>,
)
