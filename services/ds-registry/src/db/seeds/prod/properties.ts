import { sql, inArray } from 'drizzle-orm';
import * as schema from '../../schema';

export async function seedProperties(
    db: any,
    ctx: { components: { iconButton: any; button: any; link: any; checkbox: any; radiobox: any; counter: any } },
) {
    const { iconButton, button, link, checkbox, radiobox, counter } = ctx.components;

    const rows = await db
        .insert(schema.properties)
        .values([
            // ── IconButton ──────────────────────────────────────────────────────────
            {
                componentId: iconButton.id,
                name: 'loadingAlpha',
                type: 'float' as const,
                defaultValue: '0',
                description: 'Значение прозрачности в режиме загрузки',
            },
            {
                componentId: iconButton.id,
                name: 'disableAlpha',
                type: 'float' as const,
                defaultValue: '0.4',
                description: 'Значение прозрачности в отключенном варианте',
            },
            {
                componentId: iconButton.id,
                name: 'focusColor',
                type: 'color' as const,
                defaultValue: 'text.default.accent',
                description: 'Цвет обводки компонента',
            },
            {
                componentId: iconButton.id,
                name: 'backgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона кнопки',
            },
            {
                componentId: iconButton.id,
                name: 'loadingBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона в режиме загрузки',
            },
            {
                componentId: iconButton.id,
                name: 'iconColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет иконки',
            },
            {
                componentId: iconButton.id,
                name: 'spinnerColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет спиннера',
            },
            {
                componentId: iconButton.id,
                name: 'height',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Высота компонента',
            },
            {
                componentId: iconButton.id,
                name: 'paddingStart',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ слева',
            },
            {
                componentId: iconButton.id,
                name: 'paddingEnd',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ справа',
            },
            {
                componentId: iconButton.id,
                name: 'minWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Минимальная ширина',
            },
            {
                componentId: iconButton.id,
                name: 'iconSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Размер иконки',
            },
            {
                componentId: iconButton.id,
                name: 'spinnerSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Размер спиннера',
            },
            {
                componentId: iconButton.id,
                name: 'spinnerStrokeWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Толщина линии спиннера',
            },
            {
                componentId: iconButton.id,
                name: 'shape',
                type: 'shape' as const,
                defaultValue: '',
                description: 'Форма компонента',
            },

            // ── Button ──────────────────────────────────────────────────────────────
            {
                componentId: button.id,
                name: 'focusColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет обводки компонента',
            },
            {
                componentId: button.id,
                name: 'loadingAlpha',
                type: 'float' as const,
                defaultValue: '',
                description: 'Значение прозрачности в режиме загрузки',
            },
            {
                componentId: button.id,
                name: 'disableAlpha',
                type: 'float' as const,
                defaultValue: '',
                description: 'Значение прозрачности в отключенном варианте',
            },
            {
                componentId: button.id,
                name: 'shape',
                type: 'shape' as const,
                defaultValue: '',
                description: 'Форма кнопки',
            },
            {
                componentId: button.id,
                name: 'height',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Высота кнопки',
            },
            {
                componentId: button.id,
                name: 'paddingStart',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ от начала до контента',
            },
            {
                componentId: button.id,
                name: 'paddingEnd',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ от контента до конца',
            },
            {
                componentId: button.id,
                name: 'minWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Минимальная ширина кнопки',
            },
            {
                componentId: button.id,
                name: 'iconSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Размер иконки',
            },
            {
                componentId: button.id,
                name: 'spinnerSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Размер индикатора загрузки',
            },
            {
                componentId: button.id,
                name: 'spinnerStrokeWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Толщина индикатора загрузки',
            },
            {
                componentId: button.id,
                name: 'iconMargin',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ от иконки до текста',
            },
            {
                componentId: button.id,
                name: 'valueMargin',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ от label до value',
            },
            {
                componentId: button.id,
                name: 'labelStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: 'Стиль основного текста',
            },
            {
                componentId: button.id,
                name: 'valueStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: 'Стиль дополнительного текста',
            },
            {
                componentId: button.id,
                name: 'backgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона кнопки',
            },
            {
                componentId: button.id,
                name: 'loadingBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона кнопки при загрузки',
            },
            {
                componentId: button.id,
                name: 'labelColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет основного текста',
            },
            {
                componentId: button.id,
                name: 'iconColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет иконки',
            },
            {
                componentId: button.id,
                name: 'spinnerColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет индикатора загрузки',
            },
            {
                componentId: button.id,
                name: 'valueColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет дополнительного текста',
            },

            // ── Link ────────────────────────────────────────────────────────────────
            {
                componentId: link.id,
                name: 'focusColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет обводки компонента',
            },
            {
                componentId: link.id,
                name: 'disableAlpha',
                type: 'float' as const,
                defaultValue: '',
                description: 'Значение прозрачности в отключенном варианте',
            },
            {
                componentId: link.id,
                name: 'textStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: 'Стиль текста ссылки',
            },
            {
                componentId: link.id,
                name: 'textColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет текста ссылки',
            },
            {
                componentId: link.id,
                name: 'textColorVisited',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет текста посещённой ссылки',
            },
            {
                componentId: link.id,
                name: 'underlineBorderWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Толщина подчеркивания текста ссылки',
            },

            // ── Checkbox ──────────────────────────────────────────────────────────────
            {
                componentId: checkbox.id,
                name: 'focusColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет обводки компонента',
            },
            {
                componentId: checkbox.id,
                name: 'disableAlpha',
                type: 'float' as const,
                defaultValue: '',
                description: 'Значение прозрачности в отключенном варианте',
            },
            {
                componentId: checkbox.id,
                name: 'margin',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Внешний отступ',
            },
            {
                componentId: checkbox.id,
                name: 'togglePadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Внутренний отступ тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleShape',
                type: 'shape' as const,
                defaultValue: '',
                description: 'Скругление тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleBorderWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Толщина бордера тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleCheckedBorderWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Толщина бордера в состоянии checked/indeterminate',
            },
            {
                componentId: checkbox.id,
                name: 'toggleWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Ширина тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Высота тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleCheckedIconWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Ширина checked иконки тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleCheckedIconHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Высота checked иконки тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleIndeterminateIconWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Ширина indeterminate иконки тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleIndeterminateIconHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Высота indeterminate иконки тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'horizontalPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Горизонтальный отступ между тогглом и текстом',
            },
            {
                componentId: checkbox.id,
                name: 'verticalPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ лейбла и описания от верхнего края',
            },
            {
                componentId: checkbox.id,
                name: 'descriptionPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ между лейблом и описанием',
            },
            {
                componentId: checkbox.id,
                name: 'labelStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: 'Стиль подписи',
            },
            {
                componentId: checkbox.id,
                name: 'descriptionStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: 'Стиль описания',
            },
            {
                componentId: checkbox.id,
                name: 'toggleCheckedBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'iconColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет иконки',
            },
            {
                componentId: checkbox.id,
                name: 'labelColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет подписи',
            },
            {
                componentId: checkbox.id,
                name: 'descriptionColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет описания',
            },
            {
                componentId: checkbox.id,
                name: 'toggleBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона тоггла в невыбранном варианте',
            },
            {
                componentId: checkbox.id,
                name: 'toggleCheckedBorderColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет бордера тоггла',
            },
            {
                componentId: checkbox.id,
                name: 'toggleBorderColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет бордера тоггла в невыбранном варианте',
            },
            {
                componentId: checkbox.id,
                name: 'toggleIndeterminateIconColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона indeterminate иконки тоггла',
            },

            // ── Radiobox ──────────────────────────────────────────────────────────────
            {
                componentId: radiobox.id,
                name: 'focusColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет обводки компонента',
            },
            {
                componentId: radiobox.id,
                name: 'disableAlpha',
                type: 'float' as const,
                defaultValue: '',
                description: 'Значение прозрачности в отключенном варианте',
            },
            {
                componentId: radiobox.id,
                name: 'margin',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Внешний отступ',
            },
            {
                componentId: radiobox.id,
                name: 'togglePadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Внутренний отступ тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'toggleShape',
                type: 'shape' as const,
                defaultValue: '',
                description: 'Скругление тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'toggleBorderWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Толщина бордера тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'toggleCheckedBorderWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Толщина бордера в состоянии checked',
            },
            {
                componentId: radiobox.id,
                name: 'toggleWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Ширина тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'toggleHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Высота тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'ellipseWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Ширина кружка',
            },
            {
                componentId: radiobox.id,
                name: 'ellipseHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Высота кружка',
            },
            {
                componentId: radiobox.id,
                name: 'toggleCheckedIconWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Ширина checked иконки тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'toggleCheckedIconHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Высота checked иконки тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'horizontalPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Горизонтальный отступ между тогглом и текстом',
            },
            {
                componentId: radiobox.id,
                name: 'verticalPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ лейбла и описание от верхнего края',
            },
            {
                componentId: radiobox.id,
                name: 'descriptionPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: 'Отступ между лейблом и описанием',
            },
            {
                componentId: radiobox.id,
                name: 'labelStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: 'Стиль подписи',
            },
            {
                componentId: radiobox.id,
                name: 'descriptionStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: 'Стиль описания',
            },
            {
                componentId: radiobox.id,
                name: 'toggleCheckedBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'ellipseColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет кружка',
            },
            {
                componentId: radiobox.id,
                name: 'labelColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет подписи',
            },
            {
                componentId: radiobox.id,
                name: 'descriptionColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет описания',
            },
            {
                componentId: radiobox.id,
                name: 'toggleBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет фона тоггла в невыбранном варианте',
            },
            {
                componentId: radiobox.id,
                name: 'toggleCheckedBorderColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет бордера тоггла',
            },
            {
                componentId: radiobox.id,
                name: 'toggleBorderColor',
                type: 'color' as const,
                defaultValue: '',
                description: 'Цвет бордера тоггла в невыбранном варианте',
            },

            // ── Counter ──────────────────────────────────────────────────────────
            { componentId: counter.id, name: 'color', type: 'color' as const, defaultValue: '', description: '' },
            { componentId: counter.id, name: 'background', type: 'color' as const, defaultValue: '', description: '' },
            { componentId: counter.id, name: 'shape', type: 'shape' as const, defaultValue: '', description: '' },
            { componentId: counter.id, name: 'height', type: 'dimension' as const, defaultValue: '', description: '' },
            { componentId: counter.id, name: 'padding', type: 'dimension' as const, defaultValue: '', description: '' },
            {
                componentId: counter.id,
                name: 'labelStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
        ])
        .onConflictDoUpdate({
            target: [schema.properties.componentId, schema.properties.name],
            set: {
                type: sql`excluded.type`,
                defaultValue: sql`excluded.default_value`,
                description: sql`excluded.description`,
            },
        })
        .returning();

    const findIb = (name: string) => rows.find((r: any) => r.componentId === iconButton.id && r.name === name)!;
    const findBtn = (name: string) => rows.find((r: any) => r.componentId === button.id && r.name === name)!;
    const findLink = (name: string) => rows.find((r: any) => r.componentId === link.id && r.name === name)!;
    const findCb = (name: string) => rows.find((r: any) => r.componentId === checkbox.id && r.name === name)!;
    const findRb = (name: string) => rows.find((r: any) => r.componentId === radiobox.id && r.name === name)!;

    // ── Platform params ─────────────────────────────────────────────────────────
    type PlatformMap = { xml?: string[]; compose?: string[]; ios?: string[]; web?: string[] };

    const platformParamsData: { propertyId: string; platform: string; name: string }[] = [];

    function addPlatformParams(propertyId: string, params: PlatformMap) {
        for (const [platform, names] of Object.entries(params)) {
            if (names) {
                for (const n of names) {
                    platformParamsData.push({ propertyId, platform, name: n });
                }
            }
        }
    }

    // IconButton
    addPlatformParams(findIb('loadingAlpha').id, {
        xml: ['loadingAlpha'],
        compose: ['loadingAlpha'],
        ios: ['loadingAlpha'],
    });
    addPlatformParams(findIb('disableAlpha').id, {
        xml: ['disableAlpha'],
        compose: ['disableAlpha'],
        ios: ['disableAlpha'],
        web: ['iconButtonDisabledOpacity'],
    });
    addPlatformParams(findIb('focusColor').id, { web: ['iconButtonFocusColor'] });
    addPlatformParams(findIb('backgroundColor').id, {
        xml: ['backgroundTint'],
        compose: ['backgroundColor'],
        ios: ['backgroundColor'],
        web: ['iconButtonBackgroundColor'],
    });
    addPlatformParams(findIb('loadingBackgroundColor').id, { web: ['iconButtonLoadingBackgroundColor'] });
    addPlatformParams(findIb('iconColor').id, {
        xml: ['sd_iconTint'],
        compose: ['iconColor'],
        ios: ['iconColor'],
        web: ['iconButtonColor'],
    });
    addPlatformParams(findIb('spinnerColor').id, {
        xml: ['sd_spinnerTint'],
        compose: ['spinnerColor'],
        ios: ['spinnerColor'],
        web: ['iconButtonSpinnerColor'],
    });
    addPlatformParams(findIb('height').id, {
        xml: ['android:minHeight'],
        compose: ['height'],
        ios: ['height'],
        web: ['iconButtonHeight'],
    });
    addPlatformParams(findIb('paddingStart').id, {
        xml: ['android:paddingStart'],
        compose: ['paddings'],
        ios: ['paddings'],
        web: ['iconButtonPadding'],
    });
    addPlatformParams(findIb('paddingEnd').id, {
        xml: ['paddingEnd'],
        compose: ['paddings'],
        ios: ['paddings'],
        web: ['iconButtonPadding'],
    });
    addPlatformParams(findIb('minWidth').id, {
        xml: ['android:minWidth'],
        compose: ['minWidth'],
        web: ['iconButtonWidth'],
    });
    addPlatformParams(findIb('iconSize').id, { xml: ['sd_iconSize'], compose: ['iconSize'], ios: ['iconSize'] });
    addPlatformParams(findIb('spinnerSize').id, {
        xml: ['sd_spinnerSize'],
        compose: ['spinnerSize'],
        ios: ['spinnerSize'],
        web: ['iconButtonSpinnerSize'],
    });
    addPlatformParams(findIb('spinnerStrokeWidth').id, {
        xml: ['sd_spinnerStrokeWidth'],
        compose: ['spinnerStrokeWidth'],
        ios: ['spinnerStrokeWidth'],
    });
    addPlatformParams(findIb('shape').id, {
        xml: ['sd_shapeAppearance'],
        compose: ['shape'],
        ios: ['cornerRadius'],
        web: ['iconButtonRadius'],
    });

    // Button
    addPlatformParams(findBtn('focusColor').id, { web: ['buttonFocusColor'] });
    addPlatformParams(findBtn('loadingAlpha').id, {
        xml: ['loadingAlpha'],
        compose: ['loadingAlpha'],
        ios: ['loadingAlpha'],
    });
    addPlatformParams(findBtn('disableAlpha').id, {
        xml: ['disableAlpha'],
        compose: ['disableAlpha'],
        ios: ['disableAlpha'],
        web: ['buttonDisabledOpacity'],
    });
    addPlatformParams(findBtn('shape').id, {
        xml: ['sd_shapeAppearance'],
        compose: ['shape'],
        ios: ['cornerRadius'],
        web: ['buttonRadius'],
    });
    addPlatformParams(findBtn('height').id, {
        xml: ['android:minHeight'],
        compose: ['height'],
        ios: ['height'],
        web: ['buttonHeight'],
    });
    addPlatformParams(findBtn('paddingStart').id, {
        xml: ['android:paddingStart'],
        compose: ['paddings'],
        ios: ['paddings'],
    });
    addPlatformParams(findBtn('paddingEnd').id, {
        xml: ['paddingEnd'],
        compose: ['paddings'],
        ios: ['paddings'],
        web: ['buttonPadding'],
    });
    addPlatformParams(findBtn('minWidth').id, {
        xml: ['android:minWidth'],
        compose: ['minWidth'],
        web: ['buttonWidth'],
    });
    addPlatformParams(findBtn('iconSize').id, { xml: ['sd_iconSize'], compose: ['iconSize'], ios: ['iconSize'] });
    addPlatformParams(findBtn('spinnerSize').id, {
        xml: ['sd_spinnerSize'],
        compose: ['spinnerSize'],
        ios: ['spinnerSize'],
        web: ['buttonSpinnerSize'],
    });
    addPlatformParams(findBtn('spinnerStrokeWidth').id, {
        xml: ['sd_spinnerStrokeWidth'],
        compose: ['spinnerStrokeWidth'],
        ios: ['spinnerStrokeWidth'],
    });
    addPlatformParams(findBtn('iconMargin').id, {
        xml: ['sd_iconPadding'],
        compose: ['iconMargin'],
        ios: ['iconHorizontalGap'],
        web: ['buttonLeftContentMargin', 'buttonRightContentMargin'],
    });
    addPlatformParams(findBtn('valueMargin').id, {
        xml: ['sd_valuePadding'],
        compose: ['valueMargin'],
        ios: ['titleHorizontalGap'],
        web: ['buttonValueMargin'],
    });
    addPlatformParams(findBtn('labelStyle').id, {
        xml: ['android:textAppearance'],
        compose: ['labelStyle'],
        ios: ['titleTypography'],
        web: [
            'buttonFontFamily',
            'buttonFontSize',
            'buttonFontStyle',
            'buttonFontWeight',
            'buttonLetterSpacing',
            'buttonLineHeight',
        ],
    });
    addPlatformParams(findBtn('valueStyle').id, { compose: ['valueStyle'], ios: ['subtitleTypography'] });
    addPlatformParams(findBtn('backgroundColor').id, {
        xml: ['backgroundTint'],
        compose: ['backgroundColor'],
        ios: ['backgroundColor'],
        web: ['buttonBackgroundColor'],
    });
    addPlatformParams(findBtn('loadingBackgroundColor').id, { web: ['buttonLoadingBackgroundColor'] });
    addPlatformParams(findBtn('labelColor').id, {
        xml: ['android:textColor'],
        compose: ['labelColor'],
        ios: ['titleColor'],
        web: ['buttonColor'],
    });
    addPlatformParams(findBtn('iconColor').id, { xml: ['sd_iconTint'], compose: ['iconColor'], ios: ['iconColor'] });
    addPlatformParams(findBtn('spinnerColor').id, {
        xml: ['sd_spinnerTint'],
        compose: ['spinnerColor'],
        ios: ['spinnerColor'],
        web: ['buttonSpinnerColor'],
    });
    addPlatformParams(findBtn('valueColor').id, {
        xml: ['sd_valueTextColor'],
        compose: ['valueColor'],
        ios: ['subtitleColor'],
        web: ['buttonValueColor'],
    });

    // Link
    addPlatformParams(findLink('focusColor').id, { web: ['linkColorFocus'] });
    addPlatformParams(findLink('disableAlpha').id, {
        xml: ['disableAlpha'],
        compose: ['disableAlpha'],
        ios: ['disableAlpha'],
        web: ['linkDisabledOpacity'],
    });
    addPlatformParams(findLink('textStyle').id, {
        xml: ['android:minHeight'],
        compose: ['height'],
        ios: ['height'],
        web: [
            'linkFontFamily',
            'linkFontSize',
            'linkFontStyle',
            'linkFontWeight',
            'linkLetterSpacing',
            'linkLineHeight',
        ],
    });
    addPlatformParams(findLink('textColor').id, {
        xml: ['contentColor'],
        compose: ['contentColor'],
        ios: ['contentColor'],
        web: ['linkColor'],
    });
    addPlatformParams(findLink('textColorVisited').id, {
        xml: ['contentColorVisited'],
        compose: ['contentColorVisited'],
        ios: ['contentColorVisited'],
        web: ['linkColorVisited'],
    });
    addPlatformParams(findLink('underlineBorderWidth').id, {
        xml: ['underlineBorderWidth'],
        compose: ['underlineBorderWidth'],
        ios: ['underlineBorderWidth'],
        web: ['linkUnderlineBorder'],
    });

    // Checkbox
    addPlatformParams(findCb('focusColor').id, { web: ['focusColor'] });
    addPlatformParams(findCb('disableAlpha').id, {
        xml: ['disableAlpha'],
        compose: ['disableAlpha'],
        ios: ['disableAlpha'],
        web: ['disabledOpacity'],
    });
    addPlatformParams(findCb('margin').id, { web: ['margin'] });
    addPlatformParams(findCb('togglePadding').id, {
        xml: ['sd_buttonPadding'],
        compose: ['innerCheckBoxPadding'],
        web: ['triggerPadding'],
    });
    addPlatformParams(findCb('toggleShape').id, { compose: ['controlRadius'], web: ['triggerBorderRadius'] });
    addPlatformParams(findCb('toggleBorderWidth').id, { compose: ['strokeWidth'], web: ['triggerBorderWidth'] });
    addPlatformParams(findCb('toggleCheckedBorderWidth').id, { compose: ['checkedStrokeWidth'] });
    addPlatformParams(findCb('toggleWidth').id, {
        xml: ['sd_buttonSize'],
        compose: ['toggleWidth'],
        ios: ['imageSize'],
    });
    addPlatformParams(findCb('toggleHeight').id, {
        xml: ['sd_buttonSize'],
        compose: ['toggleHeight'],
        ios: ['imageSize'],
        web: ['triggerSize'],
    });
    // toggleCheckedIconWidth — no platform params
    // toggleCheckedIconHeight — no platform params
    // toggleIndeterminateIconWidth — no platform params
    // toggleIndeterminateIconHeight — no platform params
    addPlatformParams(findCb('horizontalPadding').id, {
        xml: ['android:drawablePadding'],
        compose: ['horizontalSpacing'],
        ios: ['horizontalGap'],
        web: ['contentLeftOffset'],
    });
    addPlatformParams(findCb('verticalPadding').id, { web: ['contentTopOffset'] });
    addPlatformParams(findCb('descriptionPadding').id, {
        xml: ['sd_descriptionPadding'],
        compose: ['verticalSpacing'],
        ios: ['verticalGap'],
        web: ['descriptionMarginTop'],
    });
    addPlatformParams(findCb('labelStyle').id, {
        xml: ['android:textAppearance'],
        compose: ['labelStyle'],
        ios: ['titleTypography'],
        web: [
            'labelFontFamily',
            'labelFontSize',
            'labelFontStyle',
            'labelFontWeight',
            'labelLetterSpacing',
            'labelLineHeight',
        ],
    });
    addPlatformParams(findCb('descriptionStyle').id, {
        xml: ['sd_descriptionTextAppearance'],
        compose: ['descriptionStyle'],
        ios: ['subtitleTypography'],
        web: [
            'descriptionFontFamily',
            'descriptionFontSize',
            'descriptionFontStyle',
            'descriptionFontWeight',
            'descriptionLetterSpacing',
            'descriptionLineHeight',
        ],
    });
    addPlatformParams(findCb('toggleCheckedBackgroundColor').id, {
        xml: ['sd_buttonBoxColor'],
        compose: ['checkedColor'],
        ios: ['imageTintColor'],
        web: ['fillColor'],
    });
    addPlatformParams(findCb('iconColor').id, { web: ['iconColor'] });
    addPlatformParams(findCb('labelColor').id, {
        xml: ['android:textColor'],
        compose: ['labelColor'],
        ios: ['titleColor'],
        web: ['labelColor'],
    });
    addPlatformParams(findCb('descriptionColor').id, {
        xml: ['sd_descriptionTextColor'],
        compose: ['descriptionColor'],
        ios: ['subtitleColor'],
        web: ['descriptionColor'],
    });
    addPlatformParams(findCb('toggleBackgroundColor').id, { web: ['triggerBackgroundColor'] });
    addPlatformParams(findCb('toggleCheckedBorderColor').id, { web: ['triggerBorderCheckedColor'] });
    addPlatformParams(findCb('toggleBorderColor').id, {
        xml: ['sd_buttonBorderColor'],
        compose: ['idleColor'],
        web: ['triggerBorderColor'],
    });
    addPlatformParams(findCb('toggleIndeterminateIconColor').id, {
        xml: ['sd_buttonMarkColor'],
        compose: ['baseColor'],
    });

    // Radiobox
    addPlatformParams(findRb('focusColor').id, { web: ['focusColor'] });
    addPlatformParams(findRb('disableAlpha').id, {
        xml: ['disableAlpha'],
        compose: ['disableAlpha'],
        ios: ['disableAlpha'],
        web: ['disabledOpacity'],
    });
    addPlatformParams(findRb('margin').id, { web: ['margin'] });
    addPlatformParams(findRb('togglePadding').id, {
        xml: ['sd_buttonPadding'],
        compose: ['innerRadioBoxPadding'],
        web: ['triggerPadding'],
    });
    addPlatformParams(findRb('toggleShape').id, { compose: ['controlRadius'], web: ['triggerBorderRadius'] });
    addPlatformParams(findRb('toggleBorderWidth').id, { compose: ['strokeWidth'], web: ['triggerBorderWidth'] });
    addPlatformParams(findRb('toggleCheckedBorderWidth').id, { compose: ['checkedStrokeWidth'] });
    addPlatformParams(findRb('toggleWidth').id, {
        xml: ['sd_buttonSize'],
        compose: ['toggleWidth'],
        ios: ['imageSize'],
    });
    addPlatformParams(findRb('toggleHeight').id, {
        xml: ['sd_buttonSize'],
        compose: ['toggleHeight'],
        ios: ['imageSize'],
        web: ['triggerSize'],
    });
    addPlatformParams(findRb('ellipseWidth').id, {
        xml: ['sd_buttonSize'],
        compose: ['ellipseWidth'],
        ios: ['ellipseSize'],
    });
    addPlatformParams(findRb('ellipseHeight').id, {
        xml: ['sd_buttonSize'],
        compose: ['ellipseHeight'],
        ios: ['ellipseSize'],
        web: ['ellipseSize'],
    });
    // toggleCheckedIconWidth — no platform params
    // toggleCheckedIconHeight — no platform params
    addPlatformParams(findRb('horizontalPadding').id, {
        xml: ['android:drawablePadding'],
        compose: ['horizontalSpacing'],
        ios: ['horizontalGap'],
        web: ['contentLeftOffset'],
    });
    addPlatformParams(findRb('verticalPadding').id, { web: ['contentTopOffset'] });
    addPlatformParams(findRb('descriptionPadding').id, {
        xml: ['sd_descriptionPadding'],
        compose: ['verticalSpacing'],
        ios: ['verticalGap'],
        web: ['descriptionMarginTop'],
    });
    addPlatformParams(findRb('labelStyle').id, {
        xml: ['android:textAppearance'],
        compose: ['labelStyle'],
        ios: ['titleTypography'],
        web: [
            'labelFontFamily',
            'labelFontSize',
            'labelFontStyle',
            'labelFontWeight',
            'labelLetterSpacing',
            'labelLineHeight',
        ],
    });
    addPlatformParams(findRb('descriptionStyle').id, {
        xml: ['sd_descriptionTextAppearance'],
        compose: ['descriptionStyle'],
        ios: ['subtitleTypography'],
        web: [
            'descriptionFontFamily',
            'descriptionFontSize',
            'descriptionFontStyle',
            'descriptionFontWeight',
            'descriptionLetterSpacing',
            'descriptionLineHeight',
        ],
    });
    addPlatformParams(findRb('toggleCheckedBackgroundColor').id, {
        xml: ['sd_buttonBoxColor'],
        compose: ['checkedColor'],
        ios: ['imageTintColor'],
        web: ['fillColor'],
    });
    addPlatformParams(findRb('ellipseColor').id, { web: ['ellipseColor'] });
    addPlatformParams(findRb('labelColor').id, {
        xml: ['android:textColor'],
        compose: ['labelColor'],
        ios: ['titleColor'],
        web: ['labelColor'],
    });
    addPlatformParams(findRb('descriptionColor').id, {
        xml: ['sd_descriptionTextColor'],
        compose: ['descriptionColor'],
        ios: ['subtitleColor'],
        web: ['descriptionColor'],
    });
    addPlatformParams(findRb('toggleBackgroundColor').id, { web: ['triggerBackgroundColor'] });
    addPlatformParams(findRb('toggleCheckedBorderColor').id, { web: ['triggerBorderCheckedColor'] });
    addPlatformParams(findRb('toggleBorderColor').id, {
        xml: ['sd_buttonBorderColor'],
        compose: ['idleColor'],
        web: ['triggerBorderColor'],
    });
    // Counter
    const findCounter = (name: string) => rows.find((r: any) => r.componentId === counter.id && r.name === name)!;
    addPlatformParams(findCounter('color').id, { web: ['color'] });
    addPlatformParams(findCounter('background').id, { web: ['background'] });
    addPlatformParams(findCounter('shape').id, { web: ['borderRadius'] });
    addPlatformParams(findCounter('height').id, { web: ['height'] });
    addPlatformParams(findCounter('padding').id, { web: ['padding'] });
    addPlatformParams(findCounter('labelStyle').id, {
        web: ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight'],
    });

    let platformParams: any[] = [];
    if (platformParamsData.length > 0) {
        await db.insert(schema.propertyPlatformParams).values(platformParamsData).onConflictDoNothing();
        // Load all params for our properties (includes both new and pre-existing)
        const propIdSet = rows.map((r: any) => r.id);
        platformParams = await db
            .select()
            .from(schema.propertyPlatformParams)
            .where(inArray(schema.propertyPlatformParams.propertyId, propIdSet));
    }
    console.log(`  property_platform_params: ${platformParams.length} rows`);

    const findParam = (propertyId: string, platform: string, name: string) =>
        platformParams.find((pp: any) => pp.propertyId === propertyId && pp.platform === platform && pp.name === name)!;

    const p = {
        platformParams,
        findParam,
        // IconButton
        ib_loadingAlpha: findIb('loadingAlpha'),
        ib_disableAlpha: findIb('disableAlpha'),
        ib_focusColor: findIb('focusColor'),
        ib_backgroundColor: findIb('backgroundColor'),
        ib_loadingBackgroundColor: findIb('loadingBackgroundColor'),
        ib_iconColor: findIb('iconColor'),
        ib_spinnerColor: findIb('spinnerColor'),
        ib_height: findIb('height'),
        ib_paddingStart: findIb('paddingStart'),
        ib_paddingEnd: findIb('paddingEnd'),
        ib_minWidth: findIb('minWidth'),
        ib_iconSize: findIb('iconSize'),
        ib_spinnerSize: findIb('spinnerSize'),
        ib_spinnerStrokeWidth: findIb('spinnerStrokeWidth'),
        ib_shape: findIb('shape'),
        // Button
        btn_focusColor: findBtn('focusColor'),
        btn_loadingAlpha: findBtn('loadingAlpha'),
        btn_disableAlpha: findBtn('disableAlpha'),
        btn_shape: findBtn('shape'),
        btn_height: findBtn('height'),
        btn_paddingStart: findBtn('paddingStart'),
        btn_paddingEnd: findBtn('paddingEnd'),
        btn_minWidth: findBtn('minWidth'),
        btn_iconSize: findBtn('iconSize'),
        btn_spinnerSize: findBtn('spinnerSize'),
        btn_spinnerStrokeWidth: findBtn('spinnerStrokeWidth'),
        btn_iconMargin: findBtn('iconMargin'),
        btn_valueMargin: findBtn('valueMargin'),
        btn_labelStyle: findBtn('labelStyle'),
        btn_valueStyle: findBtn('valueStyle'),
        btn_backgroundColor: findBtn('backgroundColor'),
        btn_loadingBackgroundColor: findBtn('loadingBackgroundColor'),
        btn_labelColor: findBtn('labelColor'),
        btn_iconColor: findBtn('iconColor'),
        btn_spinnerColor: findBtn('spinnerColor'),
        btn_valueColor: findBtn('valueColor'),
        // Link
        link_focusColor: findLink('focusColor'),
        link_disableAlpha: findLink('disableAlpha'),
        link_textStyle: findLink('textStyle'),
        link_textColor: findLink('textColor'),
        link_textColorVisited: findLink('textColorVisited'),
        link_underlineBorderWidth: findLink('underlineBorderWidth'),
        // Checkbox
        cb_focusColor: findCb('focusColor'),
        cb_disableAlpha: findCb('disableAlpha'),
        cb_margin: findCb('margin'),
        cb_togglePadding: findCb('togglePadding'),
        cb_toggleShape: findCb('toggleShape'),
        cb_toggleBorderWidth: findCb('toggleBorderWidth'),
        cb_toggleCheckedBorderWidth: findCb('toggleCheckedBorderWidth'),
        cb_toggleWidth: findCb('toggleWidth'),
        cb_toggleHeight: findCb('toggleHeight'),
        cb_toggleCheckedIconWidth: findCb('toggleCheckedIconWidth'),
        cb_toggleCheckedIconHeight: findCb('toggleCheckedIconHeight'),
        cb_toggleIndeterminateIconWidth: findCb('toggleIndeterminateIconWidth'),
        cb_toggleIndeterminateIconHeight: findCb('toggleIndeterminateIconHeight'),
        cb_horizontalPadding: findCb('horizontalPadding'),
        cb_verticalPadding: findCb('verticalPadding'),
        cb_descriptionPadding: findCb('descriptionPadding'),
        cb_labelStyle: findCb('labelStyle'),
        cb_descriptionStyle: findCb('descriptionStyle'),
        cb_toggleCheckedBackgroundColor: findCb('toggleCheckedBackgroundColor'),
        cb_iconColor: findCb('iconColor'),
        cb_labelColor: findCb('labelColor'),
        cb_descriptionColor: findCb('descriptionColor'),
        cb_toggleBackgroundColor: findCb('toggleBackgroundColor'),
        cb_toggleCheckedBorderColor: findCb('toggleCheckedBorderColor'),
        cb_toggleBorderColor: findCb('toggleBorderColor'),
        cb_toggleIndeterminateIconColor: findCb('toggleIndeterminateIconColor'),
        // Radiobox
        rb_focusColor: findRb('focusColor'),
        rb_disableAlpha: findRb('disableAlpha'),
        rb_margin: findRb('margin'),
        rb_togglePadding: findRb('togglePadding'),
        rb_toggleShape: findRb('toggleShape'),
        rb_toggleBorderWidth: findRb('toggleBorderWidth'),
        rb_toggleCheckedBorderWidth: findRb('toggleCheckedBorderWidth'),
        rb_toggleWidth: findRb('toggleWidth'),
        rb_toggleHeight: findRb('toggleHeight'),
        rb_ellipseWidth: findRb('ellipseWidth'),
        rb_ellipseHeight: findRb('ellipseHeight'),
        rb_toggleCheckedIconWidth: findRb('toggleCheckedIconWidth'),
        rb_toggleCheckedIconHeight: findRb('toggleCheckedIconHeight'),
        rb_horizontalPadding: findRb('horizontalPadding'),
        rb_verticalPadding: findRb('verticalPadding'),
        rb_descriptionPadding: findRb('descriptionPadding'),
        rb_labelStyle: findRb('labelStyle'),
        rb_descriptionStyle: findRb('descriptionStyle'),
        rb_toggleCheckedBackgroundColor: findRb('toggleCheckedBackgroundColor'),
        rb_ellipseColor: findRb('ellipseColor'),
        rb_labelColor: findRb('labelColor'),
        rb_descriptionColor: findRb('descriptionColor'),
        rb_toggleBackgroundColor: findRb('toggleBackgroundColor'),
        rb_toggleCheckedBorderColor: findRb('toggleCheckedBorderColor'),
        rb_toggleBorderColor: findRb('toggleBorderColor'),
        // Counter
        cou_color: findCounter('color'),
        cou_background: findCounter('background'),
        cou_shape: findCounter('shape'),
        cou_height: findCounter('height'),
        cou_padding: findCounter('padding'),
        cou_labelStyle: findCounter('labelStyle'),
    };

    console.log(`  properties: ${rows.length} rows`);
    return p;
}
