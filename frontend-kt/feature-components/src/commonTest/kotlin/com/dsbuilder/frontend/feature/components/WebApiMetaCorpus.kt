package com.dsbuilder.frontend.feature.components

/**
 * Фрагмент настоящего вывода `npm run generate:api-meta -- --package @salutejs/plasma-new-hope` из `js/cli`
 * (`@salutejs/plasma-new-hope@0.384.0-dev.0`): четыре компонента без изменений.
 *
 * Фрагмент покрывает правила нормализации:
 *
 * - `AvatarGroup`: файл токенов без словаря, компонент без параметров;
 * - `Button`: части типографики `labelStyle` (`part`), два токена одного значения у `iconMargin`, токены
 *   состояний `hovered` и `pressed` у `backgroundColor`, `buttonBorderColor` и `labelColor`, `id`, отличный от
 *   ключа токена (`buttonDisabledOpacity` → `disableAlpha`), типы `float`, `shape` и `value`;
 * - `Link`: состояния у двух свойств (`textColor`, `textColorVisited`) и типографика `textStyle`;
 * - `Spinner`: ключ токена совпадает с `id`.
 *
 * Пометок `deprecated` в этой версии пакета нет: их проверяют отдельные фрагменты в тестах.
 */
internal const val WEB_API_META_CORPUS: String = """[
{"componentName":"AvatarGroup","params":[]},
{"componentName":"Button","params":[
{"paramName":"buttonAdditionalContentMargin","type":"dimension","id":"buttonAdditionalContentMargin"},
{"paramName":"buttonAdditionalContentMarginRightWidthValue","type":"dimension",
"id":"buttonAdditionalContentMarginRightWidthValue"},
{"paramName":"buttonBackgroundColor","type":"color","id":"backgroundColor"},
{"paramName":"buttonBackgroundColorActive","type":"color","id":"backgroundColor","state":"pressed"},
{"paramName":"buttonBackgroundColorHover","type":"color","id":"backgroundColor","state":"hovered"},
{"paramName":"buttonBorderColor","type":"color","id":"buttonBorderColor"},
{"paramName":"buttonBorderColorActive","type":"color","id":"buttonBorderColor","state":"pressed"},
{"paramName":"buttonBorderColorHover","type":"color","id":"buttonBorderColor","state":"hovered"},
{"paramName":"buttonBorderWidth","type":"dimension","id":"buttonBorderWidth"},
{"paramName":"buttonColor","type":"color","id":"labelColor"},
{"paramName":"buttonColorActive","type":"color","id":"labelColor","state":"pressed"},
{"paramName":"buttonColorHover","type":"color","id":"labelColor","state":"hovered"},
{"paramName":"buttonDisabledOpacity","type":"float","id":"disableAlpha"},
{"paramName":"buttonFocusColor","type":"color","id":"focusColor"},
{"paramName":"buttonFontFamily","type":"typography","id":"labelStyle","part":"fontFamily"},
{"paramName":"buttonFontSize","type":"typography","id":"labelStyle","part":"fontSize"},
{"paramName":"buttonFontStyle","type":"typography","id":"labelStyle","part":"fontStyle"},
{"paramName":"buttonFontWeight","type":"typography","id":"labelStyle","part":"fontWeight"},
{"paramName":"buttonHeight","type":"dimension","id":"height"},
{"paramName":"buttonIconColor","type":"color","id":"buttonIconColor"},
{"paramName":"buttonLeftContentAlignSelf","type":"value","id":"buttonLeftContentAlignSelf"},
{"paramName":"buttonLeftContentMargin","type":"dimension","id":"iconMargin"},
{"paramName":"buttonLetterSpacing","type":"typography","id":"labelStyle","part":"letterSpacing"},
{"paramName":"buttonLineHeight","type":"typography","id":"labelStyle","part":"lineHeight"},
{"paramName":"buttonLoadingBackgroundColor","type":"color","id":"loadingBackgroundColor"},
{"paramName":"buttonPadding","type":"dimension","id":"paddingEnd"},
{"paramName":"buttonRadius","type":"shape","id":"shape"},
{"paramName":"buttonRadiusCircle","type":"shape","id":"buttonRadiusCircle"},
{"paramName":"buttonRightContentAlignSelf","type":"value","id":"buttonRightContentAlignSelf"},
{"paramName":"buttonRightContentMargin","type":"dimension","id":"iconMargin"},
{"paramName":"buttonScaleActive","type":"float","id":"buttonScaleActive"},
{"paramName":"buttonScaleHover","type":"float","id":"buttonScaleHover"},
{"paramName":"buttonSpinnerColor","type":"color","id":"spinnerColor"},
{"paramName":"buttonSpinnerSize","type":"dimension","id":"spinnerSize"},
{"paramName":"buttonTextColor","type":"color","id":"buttonTextColor"},
{"paramName":"buttonValueColor","type":"color","id":"valueColor"},
{"paramName":"buttonValueFontWeight","type":"typography","id":"buttonValueTypography","part":"fontWeight"},
{"paramName":"buttonValueMargin","type":"dimension","id":"valueMargin"},
{"paramName":"buttonWidth","type":"dimension","id":"minWidth"}
]},
{"componentName":"Link","params":[
{"paramName":"linkColor","type":"color","id":"textColor"},
{"paramName":"linkColorActive","type":"color","id":"textColor","state":"pressed"},
{"paramName":"linkColorFocus","type":"color","id":"focusColor"},
{"paramName":"linkColorHover","type":"color","id":"textColor","state":"hovered"},
{"paramName":"linkColorVisited","type":"color","id":"textColorVisited"},
{"paramName":"linkColorVisitedActive","type":"color","id":"textColorVisited","state":"pressed"},
{"paramName":"linkColorVisitedHover","type":"color","id":"textColorVisited","state":"hovered"},
{"paramName":"linkDisabledOpacity","type":"float","id":"disableAlpha"},
{"paramName":"linkFontFamily","type":"typography","id":"textStyle","part":"fontFamily"},
{"paramName":"linkFontSize","type":"typography","id":"textStyle","part":"fontSize"},
{"paramName":"linkFontStyle","type":"typography","id":"textStyle","part":"fontStyle"},
{"paramName":"linkFontWeight","type":"typography","id":"textStyle","part":"fontWeight"},
{"paramName":"linkLetterSpacing","type":"typography","id":"textStyle","part":"letterSpacing"},
{"paramName":"linkLineHeight","type":"typography","id":"textStyle","part":"lineHeight"},
{"paramName":"linkUnderlineBorder","type":"dimension","id":"underlineBorderWidth"},
{"paramName":"linkUnderlineColor","type":"color","id":"linkUnderlineColor"},
{"paramName":"linkUnderlineOffset","type":"dimension","id":"linkUnderlineOffset"}
]},
{"componentName":"Spinner","params":[
{"paramName":"color","type":"color","id":"color"},
{"paramName":"size","type":"dimension","id":"size"}
]}
]"""
