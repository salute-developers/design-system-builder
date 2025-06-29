export const api = [
    {
        id: '2a5e254f-a410-45dd-8010-8a21cbbdf534',
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
                    name: 'iconButtonFocusColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '335eda72-6821-482b-9cbe-88c5a0800964',
        name: 'loadingAlpha',
        type: 'float',
        description: 'Значение прозрачности в режиме загрузки',
        variations: null,
        platformMappings: {
            xml: 'loadingAlpha',
            compose: 'loadingAlpha',
            ios: 'loadingAlpha',
            web: null,
        },
    },
    {
        id: '84224542-5c94-47ab-a003-55e1f30eb3bc',
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
                    name: 'iconButtonDisabledOpacity',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'a56e5121-6580-4e48-a130-399486650921',
        name: 'shape',
        type: 'shape',
        description: 'Форма кнопки',
        variations: ['ff117f57-e58e-4fd0-b5cd-8b897e282b32', 'dbe45bb5-75df-466a-b5f2-24cf4ba2d57c'],
        platformMappings: {
            xml: 'sd_shapeAppearance',
            compose: 'shape',
            ios: 'cornerRadius',
            web: [
                {
                    name: 'iconButtonRadius',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'ae00a3a7-2897-4c63-b20e-a8b74d7788c7',
        name: 'height',
        type: 'dimension',
        description: 'Высота кнопки',
        variations: ['dbe45bb5-75df-466a-b5f2-24cf4ba2d57c'],
        platformMappings: {
            xml: 'android:minHeight',
            compose: 'height',
            ios: 'height',
            web: [
                {
                    name: 'iconButtonHeight',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '38d1fcdc-4671-4661-a432-74b9cd0f72f6',
        name: 'paddingStart',
        type: 'dimension',
        description: 'Отступ от начала до контента',
        variations: ['dbe45bb5-75df-466a-b5f2-24cf4ba2d57c'],
        platformMappings: {
            xml: 'android:paddingStart',
            compose: 'paddings',
            ios: 'paddings',
            web: [
                {
                    name: 'iconButtonPadding',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '7ac10bf4-7f25-4941-9e4e-2e3f6051a47c',
        name: 'paddingEnd',
        type: 'dimension',
        description: 'Отступ от контента до конца',
        variations: ['dbe45bb5-75df-466a-b5f2-24cf4ba2d57c'],
        platformMappings: {
            xml: 'paddingEnd',
            compose: 'paddings',
            ios: 'paddings',
            web: [
                {
                    name: 'iconButtonPadding',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '668eb9df-ae9e-43ca-a10f-af55076a1df3',
        name: 'minWidth',
        type: 'dimension',
        description: 'Минимальная ширина кнопки',
        variations: ['dbe45bb5-75df-466a-b5f2-24cf4ba2d57c'],
        platformMappings: {
            xml: 'android:minWidth',
            compose: 'minWidth',
            ios: null,
            web: [
                {
                    name: 'iconButtonWidth',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '76d2c4e9-1acc-49f2-abf0-058e086d318e',
        name: 'iconSize',
        type: 'dimension',
        description: 'Размер иконки',
        variations: ['dbe45bb5-75df-466a-b5f2-24cf4ba2d57c'],
        platformMappings: {
            xml: 'sd_iconSize',
            compose: 'iconSize',
            ios: 'iconSize',
            web: null,
        },
    },
    {
        id: '25baeb7b-f044-44ae-8aa2-b0712ffa04ae',
        name: 'spinnerSize',
        type: 'dimension',
        description: 'Размер индикатора загрузки',
        variations: ['dbe45bb5-75df-466a-b5f2-24cf4ba2d57c'],
        platformMappings: {
            xml: 'sd_spinnerSize',
            compose: 'spinnerSize',
            ios: 'spinnerSize',
            web: [
                {
                    name: 'iconButtonSpinnerSize',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'd7463b05-ef2d-4bc3-81fa-bb9c6720be50',
        name: 'spinnerStrokeWidth',
        type: 'dimension',
        description: 'Толщина индикатора загрузки',
        variations: ['dbe45bb5-75df-466a-b5f2-24cf4ba2d57c'],
        platformMappings: {
            xml: 'sd_spinnerStrokeWidth',
            compose: 'spinnerStrokeWidth',
            ios: 'spinnerStrokeWidth',
            web: null,
        },
    },
    {
        id: '9cbaf309-b76e-40f3-a989-c2528f4796d8',
        name: 'backgroundColor',
        type: 'color',
        description: 'Цвет фона кнопки',
        variations: ['30bbe50f-fcc5-4c0c-8500-244813177b22'],
        platformMappings: {
            xml: 'backgroundTint',
            compose: 'backgroundColor',
            ios: 'backgroundColor',
            web: [
                {
                    name: 'iconButtonBackgroundColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'a3a98c9c-4093-4717-b257-1cc477d6f0b5',
        name: 'loadingBackgroundColor',
        type: 'color',
        description: 'Цвет фона кнопки при загрузки',
        variations: ['30bbe50f-fcc5-4c0c-8500-244813177b22'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: [
                {
                    name: 'iconButtonLoadingBackgroundColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '9b0ca7b0-40a5-48cd-83b7-7bc366df4049',
        name: 'iconColor',
        type: 'color',
        description: 'Цвет иконки',
        variations: ['30bbe50f-fcc5-4c0c-8500-244813177b22'],
        platformMappings: {
            xml: 'sd_iconTint',
            compose: 'iconColor',
            ios: 'iconColor',
            web: [
                {
                    name: 'iconButtonColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '0f704273-c31d-4cfb-b8b4-3c5dd05e8d4f',
        name: 'spinnerColor',
        type: 'color',
        description: 'Цвет индикатора загрузки',
        variations: ['30bbe50f-fcc5-4c0c-8500-244813177b22'],
        platformMappings: {
            xml: 'sd_spinnerTint',
            compose: 'spinnerColor',
            ios: 'spinnerColor',
            web: [
                {
                    name: 'iconButtonSpinnerColor',
                    adjustment: null,
                },
            ],
        },
    },
];
