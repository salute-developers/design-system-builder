package com.dsbuilder.frontend.cli.feature.init.presentation

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.github.ajalt.mordant.animation.animation
import com.github.ajalt.mordant.input.RawModeScope
import com.github.ajalt.mordant.input.enterRawMode
import com.github.ajalt.mordant.input.isCtrlC
import com.github.ajalt.mordant.terminal.Terminal
import com.github.ajalt.mordant.widgets.SelectList
import com.github.ajalt.mordant.widgets.Text

/** Вариант меню; ID передаётся программно.
 * @property id идентификатор.
 * @property name имя.
 * @property description описание.
 */
public data class InitChoice(public val id: String, public val name: String, public val description: String?)

/** Инъецируемая граница терминального выбора для тестов без TTY. */
public interface InitSelectionMenu {
    /** Терминал поддерживает ввод клавиш и управление курсором. */
    public fun supported(terminal: Terminal): Boolean

    /** Выбирает ID; null означает Ctrl+C либо закрытый ввод. */
    public fun select(terminal: Terminal, title: String, choices: List<InitChoice>): String?
}

/** Оконное меню поверх готовых событий клавиатуры Mordant. */
internal class MordantInitSelectionMenu(private val environment: EnvironmentReader) : InitSelectionMenu {
    // Mordant 3.0.1 ставит supportsAnsiCursor=true именно для ограниченной IntelliJ run console;
    // Animation при true подавляет движения. Обычный ANSI TTY получает false, вопреки имени свойства.
    override fun supported(terminal: Terminal): Boolean = terminal.terminalInfo.interactive &&
        environment.get("TERM")?.lowercase() != "dumb" && !terminal.terminalInfo.supportsAnsiCursor &&
        terminal.size.height >= 6 && terminal.size.width >= 20

    override fun select(terminal: Terminal, title: String, choices: List<InitChoice>): String? {
        require(choices.isNotEmpty())
        val guard = preserveInitConsole()
        val state = InitMenuCursor(choices.size)
        val display = terminal.animation<Int> { cursor ->
            val width = (terminal.size.width - 4).coerceAtLeast(1)
            val rows = (terminal.size.height - 5).coerceIn(1, 12)
            val first = (cursor - rows + 1).coerceAtLeast(0)
            SelectList(
                entries = choices.drop(first).take(rows).map {
                    SelectList.Entry(safeMenuText("${it.name} [${it.id}]").take(width), description = null as String?)
                },
                title = Text(safeMenuText(title).take(width)),
                cursorIndex = cursor - first,
                captionBottom = Text(
                    safeMenuText(choices[cursor].description.orEmpty()).take(width) +
                        "\n↑/↓, Enter — выбрать, Ctrl+C — отменить (${cursor + 1}/${choices.size})",
                ),
            )
        }
        try {
            terminal.enterRawMode().use { input ->
                display.update(state.index)
                return readSelection(input, choices, state) { display.update(it) }
            }
        } finally {
            try { display.clear() } finally { guard.close() }
        }
    }

    private fun readSelection(
        input: RawModeScope,
        choices: List<InitChoice>,
        state: InitMenuCursor,
        update: (Int) -> Unit,
    ): String? {
        while (true) {
            val event = input.readKey()
            when {
                event.isCtrlC || (event.ctrl && event.key == "d") -> return null
                event.key == "Enter" -> return choices[state.index].id
                else -> {
                    state.move(event.key)
                    update(state.index)
                }
            }
        }
    }
}

/** Ограниченный курсор списка, независимый от терминального ввода. */
internal class InitMenuCursor(private val count: Int) {
    var index: Int = 0
        private set

    fun move(key: String) {
        index = when (key) {
            "ArrowDown" -> (index + 1).coerceAtMost(count - 1)
            "ArrowUp" -> (index - 1).coerceAtLeast(0)
            else -> index
        }
    }
}

private fun safeMenuText(value: String): String = value.filterNot(Char::isISOControl)

internal expect fun preserveInitConsole(): AutoCloseable
