package com.dsbuilder.frontend.core.analytics

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class AnalyticsTest {
    @Test fun eventSnapshotsInputAndRejectsNonFiniteNumbers() {
        val properties = mutableMapOf<String, AnalyticsValue>("operation" to AnalyticsValue.Text("status"))
        val event = AnalyticsEvent("finished", 100, properties)
        properties.clear()
        assertEquals(AnalyticsValue.Text("status"), event.properties["operation"])
        assertFailsWith<IllegalArgumentException> { AnalyticsValue.Number(Double.NaN) }
        assertFailsWith<IllegalArgumentException> { AnalyticsValue.Number(Double.POSITIVE_INFINITY) }
    }

    @Test fun noOpAcceptsEventsAfterRepeatedClose() = runTest {
        assertEquals(AnalyticsFlushResult.DISABLED, NoOpAnalytics.flush(1))
        NoOpAnalytics.close()
        NoOpAnalytics.close()
        NoOpAnalytics.track(AnalyticsEvent("ignored", 0, emptyMap()))
    }
}
