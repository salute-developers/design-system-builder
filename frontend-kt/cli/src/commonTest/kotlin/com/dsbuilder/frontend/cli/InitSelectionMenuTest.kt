package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.feature.init.presentation.InitChoice
import com.dsbuilder.frontend.cli.feature.init.presentation.MordantInitSelectionMenu
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.github.ajalt.mordant.input.InputEvent
import com.github.ajalt.mordant.input.KeyboardEvent
import com.github.ajalt.mordant.input.MouseTracking
import com.github.ajalt.mordant.rendering.AnsiLevel
import com.github.ajalt.mordant.rendering.Size
import com.github.ajalt.mordant.terminal.PrintRequest
import com.github.ajalt.mordant.terminal.Terminal
import com.github.ajalt.mordant.terminal.TerminalInfo
import com.github.ajalt.mordant.terminal.TerminalInterface
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.time.TimeMark

class InitSelectionMenuTest {
    private val menu = MordantInitSelectionMenu(EnvironmentReader { "xterm-256color" })
    private class FakeTerminal(private val events: MutableList<InputEvent>) : TerminalInterface {
        var restored = false
        private var rawMode = false
        var firstPrintInRawMode: Boolean? = null
        val output = StringBuilder()
        override fun info(
            ansiLevel: AnsiLevel?,
            hyperlinks: Boolean?,
            outputInteractive: Boolean?,
            inputInteractive: Boolean?,
        ) =
            TerminalInfo(AnsiLevel.TRUECOLOR, false, true, true, false)
        override fun completePrintRequest(request: PrintRequest) {
            if (firstPrintInRawMode == null) firstPrintInRawMode = rawMode
            output.append(request.text)
        }
        override fun readLineOrNull(hideInput: Boolean): String? = null
        override fun getTerminalSize() = Size(100, 12)
        override fun shouldAutoUpdateSize() = false
        override fun enterRawMode(mouseTracking: MouseTracking): AutoCloseable {
            rawMode = true
            return AutoCloseable {
                rawMode = false
                restored = true
            }
        }
        override fun readInputEvent(timeout: TimeMark, mouseTracking: MouseTracking): InputEvent =
            if (events.isNotEmpty()) events.removeAt(0) else throw IllegalStateException("fixture EOF")
    }

    @Test
    fun arrowsAndEnterScrollLongListAndRestoreRawMode() {
        val events = List(25) { KeyboardEvent("ArrowDown") } + KeyboardEvent("ArrowUp") + KeyboardEvent("Enter")
        val input = FakeTerminal(events.toMutableList())
        val terminal = Terminal(terminalInterface = input)
        assertTrue(menu.supported(terminal))
        val choices = (0..30).map { InitChoice("id-$it", "Same", "Description $it") }
        assertEquals("id-24", menu.select(terminal, "Project", choices))
        assertEquals(true, input.firstPrintInRawMode)
        assertTrue(input.restored)
        assertTrue(input.output.contains("id-24"))
    }

    @Test
    fun singleOptionStillRequiresEnterAndCancellationOrEofRestoresInput() {
        for (events in listOf(listOf(KeyboardEvent("Enter")), listOf(KeyboardEvent("c", ctrl = true)), emptyList())) {
            val input = FakeTerminal(events.toMutableList())
            val terminal = Terminal(terminalInterface = input)
            if (events.isEmpty()) {
                assertFailsWith<IllegalStateException> {
                    menu.select(
                        terminal,
                        "Project",
                        listOf(
                            InitChoice(
                                "id",
                                "Name",
                                null,
                            ),
                        ),
                    )
                }
            } else {
                assertEquals(
                    if (events.first().key == "Enter") "id" else null,
                    menu.select(terminal, "Project", listOf(InitChoice("id", "Name", null))),
                )
            }
            assertEquals(true, input.firstPrintInRawMode)
            assertTrue(input.restored)
        }
    }
}
