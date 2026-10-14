package com.dsbuilder.frontend.feature.components

/**
 * Фрагмент настоящего `ios-api-meta.json` (генератор `Tools/SDDSApiInfoGenerator` репозитория
 * plasma-ios): три компонента с их параметрами, взятыми без изменений, кроме служебных полей,
 * которые нормализатор не читает (`paramQualifiedType`, `valueQualifiedType`, `paramName`,
 * `qualifiedName`, `resolvedTypes`).
 *
 * Фрагмент выбран так, чтобы покрывать правила нормализации:
 *
 * - `CheckBox`: повтор `id` с разными `methodName` и с разными состояниями (`toggleIconColor`,
 *   `toggleIconWidth`), параметр без кода на платформе (`unmapped`), состояния с `configName`;
 * - `CollapsingNavigationBar`: повтор `id` в группе `size`, состояние без `configName`
 *   (`Collapsed` → `collapsed`);
 * - `Divider`: компонент без состояний.
 */
internal const val SWIFTUI_API_META_CORPUS: String = """[{"componentName":"CheckBox",
"stateEnum":{"values":[{"name":"checked","configName":"checked"},
{"name":"indeterminate","configName":"indeterminate"}]},
"params":[{"id":"toggleIconWidth","type":"dimension","group":"root","methodName":"",
"paramSimpleType":"","unmapped":true},
{"id":"disableAlpha","type":"float","group":"root","methodName":"disabledAlpha",
"paramSimpleType":"CGFloat"},
{"id":"toggleIconColor","type":"color","group":"root","methodName":"toggleColorChecked",
"paramSimpleType":"StatefulFillStyle"},
{"id":"toggleIconWidth","type":"dimension","group":"size","methodName":"toggleCheckedIconWidth",
"paramSimpleType":"CGFloat","state":"checked"},
{"id":"toggleIconWidth","type":"dimension","group":"size","methodName":"toggleIndeterminateIconWidth",
"paramSimpleType":"CGFloat","state":"indeterminate","stateOnly":true},
{"id":"toggleIconColor","type":"color","group":"root","methodName":"toggleColorIndeterminate",
"paramSimpleType":"StatefulFillStyle"}]},
{"componentName":"CollapsingNavigationBar","stateEnum":{"values":[{"name":"Collapsed"}]},
"params":[{"id":"titleStyle","type":"typography","group":"root","methodName":"titleTypography",
"paramSimpleType":"TypographyConfiguration"},
{"id":"titleStyle","type":"typography","group":"root","methodName":"titleTypographyCollapsed",
"paramSimpleType":"TypographyConfiguration","state":"collapsed"},
{"id":"descriptionPadding","type":"dimension","group":"size","methodName":"descriptionPadding",
"paramSimpleType":"CGFloat"},
{"id":"descriptionPadding","type":"dimension","group":"size","methodName":"descriptionPaddingCollapsed",
"paramSimpleType":"CGFloat","state":"collapsed"}]},
{"componentName":"Divider","params":[{"id":"thickness","type":"dimension","group":"root",
"methodName":"thickness","paramSimpleType":"CGFloat"},
{"id":"color","type":"color","group":"root","methodName":"color","paramSimpleType":"ColorToken"}]}]"""

/**
 * Мета с повтором `id`, у которого другой тип: первое вхождение побеждает, второе уходит в `conflicts`.
 *
 * На настоящей мете такого быть не должно — инвариант «один `id` — один тип внутри компонента»
 * закреплён тестом в репозитории iOS, — но правило общее для всех платформ и проверяется отдельно.
 */
internal const val SWIFTUI_API_META_TYPE_CONFLICT: String = """[{"componentName":"Box",
"params":[{"id":"size","type":"dimension","group":"size","methodName":"width",
"paramSimpleType":"CGFloat"},
{"id":"size","type":"float","group":"size","methodName":"scale","paramSimpleType":"CGFloat"}]}]"""

/** Мета, где у единственного компонента нет ни одного параметра с кодом на платформе. */
internal const val SWIFTUI_API_META_ONLY_UNMAPPED: String = """[{"componentName":"Box",
"params":[{"id":"size","type":"dimension","group":"root","methodName":"","unmapped":true}]}]"""
