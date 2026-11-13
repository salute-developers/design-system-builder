@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.components.domain

import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/** SVG принимается только по allowlist элементов и атрибутов. */
class SvgSafetyTest {
    private fun svg(body: String, attributes: String = "") =
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" $attributes>$body</svg>"""

    @Test
    fun `a plain icon is accepted`() {
        val icon = svg(
            """<metadata>{"category":"A &amp; B"}</metadata><defs><clipPath id="c"><rect width="24" height="24"/></clipPath>""" +
                """<linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>""" +
                """<g clip-path="url(#c)"><path d="M0 0h24v24H0z" fill="url(#g)" fill-rule="evenodd"/></g>""",
            "width=\"24\" height=\"24\" fill=\"none\"",
        )
        assertNull(SvgSafety.check(icon))
    }

    @Test
    fun `scripts and event handlers are rejected`() {
        assertNotNull(SvgSafety.check(svg("<script>alert(1)</script>")))
        assertNotNull(SvgSafety.check(svg("""<path d="M0 0" onclick="alert(1)"/>""")))
        assertNotNull(SvgSafety.check(svg("""<path d="M0 0" onload="x"/>""")))
    }

    @Test
    fun `animation that rewrites a link is rejected`() {
        assertNotNull(
            SvgSafety.check(svg("""<a href="#x"><animate attributeName="href" to="javascript:alert(1)"/></a>""")),
        )
        assertNotNull(SvgSafety.check(svg("""<set attributeName="href" to="javascript:alert(1)"/>""")))
    }

    @Test
    fun `style, anchors, foreign objects and images are rejected`() {
        assertNotNull(SvgSafety.check(svg("""<style>@import url(http://evil/x.css);</style>""")))
        assertNotNull(SvgSafety.check(svg("""<path d="M0 0" style="fill:red"/>""")))
        assertNotNull(SvgSafety.check(svg("""<a href="https://evil"><path d="M0 0"/></a>""")))
        assertNotNull(SvgSafety.check(svg("""<foreignObject><div/></foreignObject>""")))
        assertNotNull(SvgSafety.check(svg("""<image href="data:image/png;base64,AAAA"/>""")))
    }

    @Test
    fun `only local references are allowed`() {
        assertNull(SvgSafety.check(svg("""<defs><path id="p" d="M0 0"/></defs><use href="#p"/>""")))
        assertNotNull(SvgSafety.check(svg("""<use href="https://evil/x.svg#p"/>""")))
        assertNotNull(
            SvgSafety.check(
                svg("""<use xlink:href="data:image/svg+xml,x"/>""", "xmlns:xlink=\"http://www.w3.org/1999/xlink\""),
            ),
        )
        assertNotNull(SvgSafety.check(svg("""<path d="M0 0" fill="url(http://evil/x)"/>""")))
        assertNotNull(SvgSafety.check(svg("""<path d="M0 0" fill="javascript:alert(1)"/>""")))
    }

    @Test
    fun `doctype and entities are rejected without expansion`() {
        val billion = """<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]>""" +
            """<svg xmlns="http://www.w3.org/2000/svg"><title>&b;</title></svg>"""
        assertNotNull(SvgSafety.check(billion))
        val xxe = """<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>"""
        assertNotNull(SvgSafety.check(xxe))
    }

    @Test
    fun `root must be svg and the document must be well formed`() {
        assertNotNull(SvgSafety.check("""<html xmlns="http://www.w3.org/2000/svg"/>"""))
        assertNotNull(SvgSafety.check("""<svg xmlns="http://www.w3.org/2000/svg"><path></svg>"""))
        assertNotNull(SvgSafety.check("""<svg><path d="M0 0"/></svg>"""))
        assertNotNull(SvgSafety.check(""))
    }
}
