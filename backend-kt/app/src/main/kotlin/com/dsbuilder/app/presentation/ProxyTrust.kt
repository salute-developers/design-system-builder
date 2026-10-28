package com.dsbuilder.app.presentation

import java.net.InetAddress

/** Явный список доверенных IP/CIDR без разрешения произвольных DNS-имён. */
class ProxyTrust(cidrs: List<String>) {
    private data class Network(val bytes: ByteArray, val prefix: Int)
    private val networks = cidrs.map { cidr ->
        val parts = cidr.split('/')
        require(parts.size <= 2) { "Invalid BACKEND_TRUSTED_PROXIES" }
        val bytes = numericAddress(parts[0]) ?: error("Invalid BACKEND_TRUSTED_PROXIES address")
        val prefix = parts.getOrNull(1)?.toInt() ?: bytes.size * 8
        require(prefix in 0..bytes.size * 8) { "Invalid BACKEND_TRUSTED_PROXIES prefix" }
        Network(bytes, prefix)
    }

    /** Возвращает первый недоверенный адрес с правой стороны цепочки прокси. */
    fun clientAddress(peer: String, forwardedFor: String?): String {
        if (!trusted(peer)) return peer
        val chain = forwardedFor?.split(',')?.map(String::trim).orEmpty()
        if (chain.size > 32 || chain.any { numericAddress(it) == null }) return peer
        return chain.asReversed().firstOrNull { !trusted(it) } ?: chain.firstOrNull() ?: peer
    }

    private fun trusted(address: String): Boolean {
        if (networks.isEmpty()) return false
        val bytes = numericAddress(address) ?: return false
        return networks.any { network ->
            bytes.size == network.bytes.size && (0 until network.prefix).all { bit ->
                val mask = 1 shl (7 - bit % 8)
                (bytes[bit / 8].toInt() and mask) == (network.bytes[bit / 8].toInt() and mask)
            }
        }
    }

    private fun numericAddress(value: String): ByteArray? {
        if (!value.matches(Regex("[0-9a-fA-F:.]+"))) return null
        return runCatching { InetAddress.getByName(value).address }.getOrNull()
    }
}
