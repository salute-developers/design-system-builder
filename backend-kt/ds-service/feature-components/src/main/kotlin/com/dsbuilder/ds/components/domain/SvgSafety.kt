package com.dsbuilder.ds.components.domain

import java.io.StringReader
import javax.xml.XMLConstants
import javax.xml.stream.XMLInputFactory
import javax.xml.stream.XMLStreamConstants
import javax.xml.stream.XMLStreamException
import javax.xml.stream.XMLStreamReader

/**
 * Проверка SVG по allowlist: разбор без DTD и внешних сущностей, только графические элементы и атрибуты
 * представления, ссылки только локальные (`#id`).
 */
object SvgSafety {
    private const val SVG_NS = "http://www.w3.org/2000/svg"

    private val ELEMENTS = setOf(
        "svg", "g", "defs", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "clipPath", "mask",
        "linearGradient", "radialGradient", "stop", "title", "desc", "metadata", "use",
    )

    private val ATTRIBUTES = setOf(
        "id", "viewBox", "width", "height", "fill", "fill-rule", "fill-opacity", "clip-rule", "stroke", "stroke-width",
        "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke-dasharray",
        "stroke-dashoffset", "opacity", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "fx",
        "fy", "points", "transform", "clip-path", "mask", "offset", "stop-color", "stop-opacity", "gradientUnits",
        "gradientTransform", "maskUnits", "maskContentUnits", "clipPathUnits", "preserveAspectRatio", "version",
        "mask-type", "color", "display", "visibility",
    )

    /** Первый элемент документа — `svg`; пролог, комментарии и пробелы перед ним допустимы. */
    private val ROOT = Regex("^\\s*(?:<\\?xml[^>]*\\?>\\s*)?(?:<!--.*?-->\\s*)*<svg[\\s>]", RegexOption.DOT_MATCHES_ALL)

    private val LOCAL_REFERENCE = Regex("^#[A-Za-z_][\\w.:-]*$")

    /** Значение без скриптовых схем, разметки и функциональных ссылок на что-либо кроме `#id`. */
    private val SAFE_VALUE = Regex(
        "^(?!.*(?:javascript:|data:|vbscript:|@import|[<&]))(?!.*url\\(\\s*['\"]?(?!#)).*$",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL),
    )

    private val FACTORY = XMLInputFactory.newFactory().apply {
        setProperty(XMLInputFactory.SUPPORT_DTD, false)
        setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)
        setProperty(XMLInputFactory.IS_REPLACING_ENTITY_REFERENCES, false)
        setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "")
    }

    /** Возвращает описание нарушения или `null`, если SVG допустим. */
    fun check(svg: String): String? = try {
        "Корневой элемент должен быть svg".takeUnless { ROOT.containsMatchIn(svg) }
            ?: scan(FACTORY.createXMLStreamReader(StringReader(svg)))
    } catch (_: XMLStreamException) {
        "SVG не разбирается или содержит DTD"
    }

    private fun scan(reader: XMLStreamReader): String? {
        while (reader.hasNext()) {
            val issue = when (reader.next()) {
                XMLStreamConstants.START_ELEMENT -> elementIssue(reader)
                XMLStreamConstants.DTD, XMLStreamConstants.ENTITY_REFERENCE -> "Недопустимое объявление"
                else -> null
            }
            if (issue != null) return issue
        }
        return null
    }

    private fun elementIssue(reader: XMLStreamReader): String? {
        val name = reader.localName
        val element = "Недопустимый элемент $name".takeIf { reader.namespaceURI != SVG_NS || name !in ELEMENTS }
        return element ?: (0 until reader.attributeCount).firstNotNullOfOrNull { attributeIssue(reader, it, name) }
    }

    private fun attributeIssue(reader: XMLStreamReader, index: Int, element: String): String? {
        val name = reader.getAttributeLocalName(index)
        val value = reader.getAttributeValue(index)
        val link = name == "href" && element == "use" && LOCAL_REFERENCE.matches(value)
        val plain = reader.getAttributeNamespace(index).isNullOrEmpty() && name in ATTRIBUTES
        return "Недопустимый атрибут $name".takeIf { !(link || plain && SAFE_VALUE.matches(value)) }
    }
}
