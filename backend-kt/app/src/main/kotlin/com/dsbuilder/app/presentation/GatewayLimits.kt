package com.dsbuilder.app.presentation

/** Ограниченный по памяти регулятор частоты и количества активных запросов DS. */
internal class GatewayLimits(private val clock: () -> Long = System::nanoTime) {
    private data class Client(var debt: Double, var last: Long)
    private val clients = linkedMapOf<String, Client>()
    private val active = mutableMapOf<String, Int>()

    @Synchronized
    fun allow(ip: String): Boolean {
        val now = clock()
        val client = clients[ip]
        if (client == null) {
            clients.entries.removeIf { now - it.value.last > 60_000_000_000L }
            if (clients.size >= 10_000) return false
            clients[ip] = Client(1.0, now)
            return true
        }
        val debt = (client.debt - (now - client.last) / 1_000_000_000.0 * 10).coerceAtLeast(0.0)
        client.last = now
        val accepted = debt + 1 <= 21
        client.debt = if (accepted) debt + 1 else debt
        return accepted
    }

    @Synchronized
    fun acquire(key: String): Boolean {
        val count = active[key] ?: 0
        if (count >= 16 || count == 0 && active.size >= 10_000) return false
        active[key] = count + 1
        return true
    }

    @Synchronized
    fun release(key: String) {
        val count = active[key] ?: return
        if (count <= 1) active.remove(key) else active[key] = count - 1
    }
}
