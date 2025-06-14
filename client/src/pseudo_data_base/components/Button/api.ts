export const staticAPI = [
    {
        name: 'disabled',
        id: '90a75880-e54b-41d5-b601-591cb5cb4026',
        value: false,
    },
    {
        name: 'isLoading',
        id: '29cac6b3-1c19-4789-b40d-6c1cf69ce7cd',
        value: false,
    },
    {
        name: 'stretching',
        id: '53b7374c-0f1f-4bd9-b8dc-c2719dbf0ad2',
        value: 'fixed',
        items: [
            {
                value: 'auto',
                label: 'auto',
            },
            {
                value: 'filled',
                label: 'filled',
            },
            {
                value: 'fixed',
                label: 'fixed',
            },
        ],
    },
    {
        name: 'contentPlacing',
        id: '290d4aed-7983-483d-b19a-b4ded95a0015',
        value: 'default',
        items: [
            {
                value: 'default',
                label: 'default',
            },
            {
                value: 'relaxed',
                label: 'relaxed',
            },
        ],
    },
    {
        name: 'value',
        id: '49985dd9-9eaf-41ac-a17c-5e4074552838',
        value: 'value',
    },
    {
        name: 'text',
        id: '3ce09c7e-b7fb-4d5d-a1a3-e040afb45e52',
        value: 'Text',
    },
    {
        name: 'enableContentLeft',
        id: 'f0eab061-6ee9-4d8e-94bb-82d30e6e9fe5',
        value: true,
    },
    {
        name: 'enableContentRight',
        id: '330e24eb-dfad-48a8-a33a-d0246323203c',
        value: false,
    },
];

export const api = [
    {
        id: '009ed24a-f280-4965-b447-ae76d877c2ce',
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
                    name: 'buttonFocusColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'fe425fd1-736c-4bc0-ac3d-bb4d0e73b4fb',
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
        id: 'cda37c2e-9066-46e1-9f91-85e02df22128',
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
                    name: 'buttonDisabledOpacity',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'ac0f104f-43d2-4721-903c-0dea7940c512',
        name: 'shape',
        type: 'shape',
        description: 'Форма кнопки',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d', '612e4eb2-a0f5-4063-a2d4-f3b840d83176'],
        platformMappings: {
            xml: 'sd_shapeAppearance',
            compose: 'shape',
            ios: 'cornerRadius',
            web: [
                {
                    name: 'buttonRadius',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '22e7658b-4c6f-4cca-a572-3215e7dab4de',
        name: 'height',
        type: 'dimension',
        description: 'Высота кнопки',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'android:minHeight',
            compose: 'height',
            ios: 'height',
            web: [
                {
                    name: 'buttonHeight',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '10c7487d-9393-4ab0-adcf-ce07d47b87bf',
        name: 'paddingStart',
        type: 'dimension',
        description: 'Отступ от начала до контента',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'android:paddingStart',
            compose: 'paddings',
            ios: 'paddings',
            web: null,
        },
    },
    {
        id: '0a2c41ef-1fd0-4d56-a592-0074f5c7fa82',
        name: 'paddingEnd',
        type: 'dimension',
        description: 'Отступ от контента до конца',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'paddingEnd',
            compose: 'paddings',
            ios: 'paddings',
            web: [
                {
                    name: 'buttonPadding',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '0d3d5fac-0d66-44d3-bc74-fdd1aefcd9e8',
        name: 'minWidth',
        type: 'dimension',
        description: 'Минимальная ширина кнопки',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'android:minWidth',
            compose: 'minWidth',
            ios: null,
            web: [
                {
                    name: 'buttonWidth',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '7f55df82-7529-4931-9ea9-24685f8400c0',
        name: 'iconSize',
        type: 'dimension',
        description: 'Размер иконки',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'sd_iconSize',
            compose: 'iconSize',
            ios: 'iconSize',
            web: null,
        },
    },
    {
        id: 'f662fef0-db6a-4581-b5e4-40c7ca3f4518',
        name: 'spinnerSize',
        type: 'dimension',
        description: 'Размер индикатора загрузки',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'sd_spinnerSize',
            compose: 'spinnerSize',
            ios: 'spinnerSize',
            web: [
                {
                    name: 'buttonSpinnerSize',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'a4ffa819-94c8-44d0-bb81-1e3d2983d3bf',
        name: 'spinnerStrokeWidth',
        type: 'dimension',
        description: 'Толщина индикатора загрузки',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'sd_spinnerStrokeWidth',
            compose: 'spinnerStrokeWidth',
            ios: 'spinnerStrokeWidth',
            web: null,
        },
    },
    {
        id: '3d266690-3c5d-4c0d-bdef-4061f33da965',
        name: 'iconMargin',
        type: 'dimension',
        description: 'Отступ от иконки до текста',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'sd_iconPadding',
            compose: 'iconMargin',
            ios: 'iconHorizontalGap',
            web: [
                {
                    name: 'buttonLeftContentMargin',
                    adjustment: '0 $1 -0.125rem',
                },
                {
                    name: 'buttonRightContentMargin',
                    adjustment: '0 -0.125rem 0 $1',
                },
            ],
        },
    },
    {
        id: '341470bc-1e36-49df-abdf-3eefb2dd69aa',
        name: 'valueMargin',
        type: 'dimension',
        description: 'Отступ от label до value',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'sd_valuePadding',
            compose: 'valueMargin',
            ios: 'titleHorizontalGap',
            web: [
                {
                    name: 'buttonValueMargin',
                    adjustment: '0 0 0 $1',
                },
            ],
        },
    },
    {
        id: '2c469518-0d23-496c-80df-e7d1a40c89c0',
        name: 'labelStyle',
        type: 'typography',
        description: 'Стиль основного текста',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: 'android:textAppearance',
            compose: 'labelStyle',
            ios: 'titleTypography',
            web: [
                {
                    name: 'buttonFontFamily',
                    adjustment: null,
                },
                {
                    name: 'buttonFontSize',
                    adjustment: null,
                },
                {
                    name: 'buttonFontStyle',
                    adjustment: null,
                },
                {
                    name: 'buttonFontWeight',
                    adjustment: null,
                },
                {
                    name: 'buttonLetterSpacing',
                    adjustment: null,
                },
                {
                    name: 'buttonLineHeight',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '9714f333-e749-4a7b-9f9f-54485f46e74a',
        name: 'valueStyle',
        type: 'typography',
        description: 'Стиль дополнительного текста',
        variations: ['e5673eeb-e400-4a78-85a6-db8af58e0b9d'],
        platformMappings: {
            xml: null,
            compose: 'valueStyle',
            ios: 'subtitleTypography',
            web: null,
        },
    },
    {
        id: '391eb64b-db8d-481d-a0e9-c59872e36df9',
        name: 'backgroundColor',
        type: 'color',
        description: 'Цвет фона кнопки',
        variations: ['920ef737-130a-49cb-92e3-d3fab7ef8f97'],
        platformMappings: {
            xml: 'backgroundTint',
            compose: 'backgroundColor',
            ios: 'backgroundColor',
            web: [
                {
                    name: 'buttonBackgroundColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '1be1723a-4b32-463e-b4f0-c600fa3ee379',
        name: 'loadingBackgroundColor',
        type: 'color',
        description: 'Цвет фона кнопки при загрузки',
        variations: ['920ef737-130a-49cb-92e3-d3fab7ef8f97'],
        platformMappings: {
            xml: null,
            compose: null,
            ios: null,
            web: [
                {
                    name: 'buttonLoadingBackgroundColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'c1830233-ad3a-42fd-9b25-7e4540c54723',
        name: 'labelColor',
        type: 'color',
        description: 'Цвет основного текста	',
        variations: ['920ef737-130a-49cb-92e3-d3fab7ef8f97'],
        platformMappings: {
            xml: 'android:textColor	',
            compose: 'labelColor',
            ios: 'titleColor',
            web: [
                {
                    name: 'buttonColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: '2c72de45-4489-4399-9743-474becc74497',
        name: 'iconColor',
        type: 'color',
        description: 'Цвет иконки',
        variations: ['920ef737-130a-49cb-92e3-d3fab7ef8f97'],
        platformMappings: {
            xml: 'sd_iconTint',
            compose: 'iconColor',
            ios: 'iconColor',
            web: null,
        },
    },
    {
        id: 'df6d4fed-be24-4b93-a239-05d720dfd6c4',
        name: 'spinnerColor',
        type: 'color',
        description: 'Цвет индикатора загрузки',
        variations: ['920ef737-130a-49cb-92e3-d3fab7ef8f97'],
        platformMappings: {
            xml: 'sd_spinnerTint',
            compose: 'spinnerColor',
            ios: 'spinnerColor',
            web: [
                {
                    name: 'buttonSpinnerColor',
                    adjustment: null,
                },
            ],
        },
    },
    {
        id: 'f845fd0e-c489-4f4e-a69c-38a2840bead7',
        name: 'valueColor',
        type: 'color',
        description: 'Цвет дополнительного текста',
        variations: ['920ef737-130a-49cb-92e3-d3fab7ef8f97'],
        platformMappings: {
            xml: 'sd_valueTextColor',
            compose: 'valueColor',
            ios: 'subtitleColor',
            web: [
                {
                    name: 'buttonValueColor',
                    adjustment: null,
                },
            ],
        },
    },
];
