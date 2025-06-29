export const api = [
    {
        id: '7fb3c7d3-fc44-442f-922a-a3252d52c0b2',
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
                    name: 'linkColorFocus',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '693588ee-0764-490d-99f8-28ce6178b7bf',
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
                    name: 'linkDisabledOpacity',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '9b847ca6-7df1-4071-9606-bc9549fbc5e9',
        name: 'textStyle',
        type: 'typography',
        description: 'Стиль текста ссылки',
        variations: ['c6a063f8-61ca-4cd1-a4aa-e344124efd93'],
        platformMappings: {
            xml: 'android:minHeight',
            compose: 'height',
            ios: 'height',
            web: [
                {
                    name: 'linkFontFamily',
                    adjustment: null,
                },
                {
                    name: 'linkFontSize',
                    adjustment: null,
                },
                {
                    name: 'linkFontStyle',
                    adjustment: null,
                },
                {
                    name: 'linkFontWeight',
                    adjustment: null,
                },
                {
                    name: 'linkLetterSpacing',
                    adjustment: null,
                },
                {
                    name: 'linkLineHeight',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'cadd5c65-908b-4994-82a5-523653f45634',
        name: 'textColor',
        type: 'color',
        description: 'Цвет текста ссылки',
        variations: ['44763fc1-dc55-408a-9be0-2a3a6aa40092'],
        platformMappings: {
            xml: 'contentColor',
            compose: 'contentColor',
            ios: 'contentColor',
            web: [
                {
                    name: 'linkColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'b983383f-e406-4360-955d-da0387d820c0',
        name: 'textColorVisited',
        type: 'color',
        description: 'Цвет текста посещённой ссылки',
        variations: ['44763fc1-dc55-408a-9be0-2a3a6aa40092'],
        platformMappings: {
            xml: 'contentColorVisited',
            compose: 'contentColorVisited',
            ios: 'contentColorVisited',
            web: [
                {
                    name: 'linkColorVisited',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '600bbba2-ebef-4bf2-963a-1ff23ffe357f',
        name: 'underlineBorderWidth',
        type: 'dimension',
        description: 'Толщина подчеркивания текста ссылки',
        variations: ['44763fc1-dc55-408a-9be0-2a3a6aa40092'],
        platformMappings: {
            xml: 'underlineBorderWidth',
            compose: 'underlineBorderWidth',
            ios: 'underlineBorderWidth',
            web: [
                {
                    name: 'linkUnderlineBorder',
                    adjustment: null,
                },
            ],
        },
    },
];
