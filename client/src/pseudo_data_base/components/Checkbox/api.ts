export const api = [
    {
        id: '1b7d6e7d-7c34-45a1-bcdb-9e0fbd66f92a',
        name: 'focusColor',
        type: 'color',
        description: 'Цвет обводки компонента',
        variations: null,
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: [
                {
                    name: 'focusColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'a8b6d4ac-b0bf-4530-bc4d-a1718bbe585b',
        name: 'disableAlpha',
        type: 'float',
        description: 'Значение прозрачности в отключенном варианте',
        variations: null,
        platformMappings: {
            xml: 'disableAlpha',
            compose: 'disableAlpha',
            ios: 'disableAlpha',
            web: [
                {
                    name: 'disabledOpacity',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '22e7658b-4c6f-4cca-a572-3215e7dab4de',
        name: 'margin',
        type: 'dimension',
        description: 'Внешний отступ',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: [
                {
                    name: 'margin',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '3332e569-d139-430c-bff4-647396132d45',
        name: 'togglePadding',
        type: 'dimension',
        description: 'Внутренний отступ тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: 'sd_buttonPadding',
            compose: 'innerCheckBoxPadding',
            ios: null,
            web: [
                {
                    name: 'triggerPadding',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '87f08778-e272-4f3e-9242-2e389d0d0edc',
        name: 'toggleShape',
        type: 'shape',
        description: 'Скругление тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: 'controlRadius',
            ios: null,
            web: [
                {
                    name: 'triggerBorderRadius',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '50d0070a-b515-4e37-9526-b16a4cc1b899',
        name: 'toggleBorderWidth',
        type: 'dimension',
        description: 'Толщина бордера тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: 'strokeWidth',
            ios: null,
            web: [
                {
                    name: 'triggerBorderWidth',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'bb585249-d491-42f2-906e-63b7a10a9379',
        name: 'toggleCheckedBorderWidth',
        type: 'dimension',
        description: 'Толщина бордера в состоянии checked/indeterminate',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: 'checkedStrokeWidth',
            ios: null,
            web: null,
        },
    },
    {
        id: 'adeac05d-65ec-4ff6-9fc0-6a8ff733f31f',
        name: 'toggleWidth',
        type: 'dimension',
        description: 'Ширина тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: 'sd_buttonSize',
            compose: 'toggleWidth',
            ios: 'imageSize',
            web: null,
        },
    },
    {
        id: 'e4b988a0-840e-4b5a-928f-70a539c2ba7a',
        name: 'toggleHeight',
        type: 'dimension',
        description: 'Высота тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: 'sd_buttonSize',
            compose: 'toggleHeight',
            ios: 'imageSize',
            web: [
                {
                    name: 'triggerSize',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'f8d80eff-f183-478a-9b3e-9c3ac2339bb5',
        name: 'toggleCheckedIconWidth',
        type: 'dimension',
        description: 'Ширина checked иконки тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: null,
        },
    },
    {
        id: '6b223090-073f-4285-a649-3637735ceef8',
        name: 'toggleCheckedIconHeight',
        type: 'dimension',
        description: 'Высота checked иконки тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: null,
        },
    },
    {
        id: 'c7d383d4-89c1-4386-be42-407f9104ffce',
        name: 'toggleIndeterminateIconWidth',
        type: 'dimension',
        description: 'Ширина indeterminate иконки тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: null,
        },
    },
    {
        id: 'cb200ff1-d4eb-47f9-81d1-1e16c3ce8d3f',
        name: 'toggleIndeterminateIconHeight',
        type: 'dimension',
        description: 'Высота indeterminate иконки тоггла',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: null,
        },
    },
    {
        id: '58de266b-cebb-4ddb-8409-c54ab00ccd1a',
        name: 'horizontalPadding',
        type: 'dimension',
        description: 'Горизонтальный отступ между тогглом и текстом',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: 'android:drawablePadding',
            compose: 'horizontalSpacing',
            ios: 'horizontalGap',
            web: [
                {
                    name: 'contentLeftOffset',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '94ac045b-700a-4c02-a1d8-c7e8807d643a',
        name: 'verticalPadding',
        type: 'dimension',
        description: 'Отступ лейбла и описание от верхнего края',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: [
                {
                    name: 'contentTopOffset',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '2d5c39ff-bbaf-4072-b9cc-6bddc8f5b874',
        name: 'descriptionPadding',
        type: 'dimension',
        description: 'Отступ между лейблом и описанием',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: 'sd_descriptionPadding',
            compose: 'verticalSpacing',
            ios: 'verticalGap',
            web: [
                {
                    name: 'descriptionMarginTop',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '88c4d943-a881-44a6-90f2-745fcd8f52ba',
        name: 'labelStyle',
        type: 'typography',
        description: 'Стиль подписи',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: 'android:textAppearance',
            compose: 'labelStyle',
            ios: 'titleTypography',
            web: [
                {
                    name: 'labelFontFamily',
                    adjustment: null,
                },
                {
                    name: 'labelFontSize',
                    adjustment: null,
                },
                {
                    name: 'labelFontStyle',
                    adjustment: null,
                },
                {
                    name: 'labelFontWeight',
                    adjustment: null,
                },
                {
                    name: 'labelLetterSpacing',
                    adjustment: null,
                },
                {
                    name: 'labelLineHeight',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '78e7b265-5377-4e2a-8232-c5414646ec57',
        name: 'descriptionStyle',
        type: 'typography',
        description: 'Стиль описания',
        variations: ['502ae3aa-66bb-479a-8fb3-f489f7aba3b2'],
        platformMappings: {
            xml: 'sd_descriptionTextAppearance',
            compose: 'descriptionStyle',
            ios: 'subtitleTypography',
            web: [
                {
                    name: 'descriptionFontFamily',
                    adjustment: null,
                },
                {
                    name: 'descriptionFontSize',
                    adjustment: null,
                },
                {
                    name: 'descriptionFontStyle',
                    adjustment: null,
                },
                {
                    name: 'descriptionFontWeight',
                    adjustment: null,
                },
                {
                    name: 'descriptionLetterSpacing',
                    adjustment: null,
                },
                {
                    name: 'descriptionLineHeight',
                    adjustment: null,
                },
            ],
        },
    },

    {
        id: 'c6034c7e-40ee-4dd1-8a45-d0a64b24da59',
        name: 'toggleCheckedBackgroundColor',
        type: 'color',
        description: 'Цвет фона тоггла',
        variations: ['8b3c2972-faa4-40a4-9567-8bc1ed3f3dee'],
        platformMappings: {
            xml: 'sd_buttonBoxColor',
            compose: 'checkedColor',
            ios: 'imageTintColor',
            web: [
                {
                    name: 'fillColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'e52b3045-499b-4234-9699-ebf388d03e4b',
        name: 'iconColor',
        type: 'color',
        description: 'Цвет иконки',
        variations: ['8b3c2972-faa4-40a4-9567-8bc1ed3f3dee'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: [
                {
                    name: 'iconColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '7eb89929-d5c4-46cd-a3e3-935747efd765',
        name: 'labelColor',
        type: 'color',
        description: 'Цвет подписи',
        variations: ['8b3c2972-faa4-40a4-9567-8bc1ed3f3dee'],
        platformMappings: {
            xml: 'android:textColor',
            compose: 'labelColor',
            ios: 'titleColor',
            web: [
                {
                    name: 'labelColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'ed84b708-0067-47c8-b0c6-9d5f2774ff56',
        name: 'descriptionColor',
        type: 'color',
        description: 'Цвет описания',
        variations: ['8b3c2972-faa4-40a4-9567-8bc1ed3f3dee'],
        platformMappings: {
            xml: 'sd_descriptionTextColor',
            compose: 'descriptionColor',
            ios: 'subtitleColor',
            web: [
                {
                    name: 'descriptionColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '73f023a0-d36a-4018-a106-8db574a0cb5d',
        name: 'toggleBackgroundColor',
        type: 'color',
        description: 'Цвет фона тоггла в невыбранном варианте',
        variations: ['8b3c2972-faa4-40a4-9567-8bc1ed3f3dee'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: [
                {
                    name: 'triggerBackgroundColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'f37d25d8-338a-48dc-b4bb-38c827c490e8',
        name: 'toggleCheckedBorderColor',
        type: 'color',
        description: 'Цвет бордера тоггла',
        variations: ['8b3c2972-faa4-40a4-9567-8bc1ed3f3dee'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: [
                {
                    name: 'triggerBorderCheckedColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '55db8d7c-fa2d-4f89-86c8-ed9c9553439e',
        name: 'toggleBorderColor',
        type: 'color',
        description: 'Цвет бордера тоггла в невыбранном варианте',
        variations: ['8b3c2972-faa4-40a4-9567-8bc1ed3f3dee'],
        platformMappings: {
            xml: 'sd_buttonBorderColor',
            compose: 'idleColor',
            ios: null,
            web: [
                {
                    name: 'triggerBorderColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '7443414d-d039-4070-8f9b-9b13c8b8a497',
        name: 'toggleIndeterminateIconColor',
        type: 'color',
        description: 'Цвет фона indeterminate иконки тоггла',
        variations: ['8b3c2972-faa4-40a4-9567-8bc1ed3f3dee'],
        platformMappings: {
            xml: 'sd_buttonMarkColor',
            compose: 'baseColor',
            ios: null,
            web: null,
        },
    },
];
