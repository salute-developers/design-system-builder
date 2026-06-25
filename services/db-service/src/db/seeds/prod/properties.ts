import { sql, inArray } from 'drizzle-orm';
import * as schema from '../../schema';

export async function seedProperties(
    db: any,
    ctx: {
        components: {
            iconButton: any;
            button: any;
            link: any;
            checkbox: any;
            radiobox: any;
            counter: any;
            indicator: any;
            badge: any;
            spinner: any;
            chip: any;
            switchComponent: any;
            skeleton: any;
            list: any;
            linkButton: any;
            embedIconButton: any;
            cell: any;
            divider: any;
            emptyState: any;
            accordion: any;
        };
    },
) {
    const {
        iconButton,
        button,
        link,
        checkbox,
        radiobox,
        counter,
        indicator,
        badge,
        spinner,
        chip,
        switchComponent,
        skeleton,
        list,
        linkButton,
        embedIconButton,
        cell,
        divider,
        emptyState,
        accordion,
    } = ctx.components;

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

            // ── Indicator ──────────────────────────────────────────────────────────
            { componentId: indicator.id, name: 'size', type: 'dimension' as const, defaultValue: '', description: '' },
            { componentId: indicator.id, name: 'color', type: 'color' as const, defaultValue: '', description: '' },

            // ── Badge ──────────────────────────────────────────────────────────
            {
                componentId: badge.id,
                name: 'textStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: badge.id,
                name: 'leftContentMarginLeft',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: badge.id,
                name: 'rightContentMarginRight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: badge.id, name: 'background', type: 'color' as const, defaultValue: '', description: '' },
            { componentId: badge.id, name: 'color', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: badge.id,
                name: 'paddingIconOnly',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: badge.id,
                name: 'colorTransparent',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: badge.id, name: 'colorClear', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: badge.id,
                name: 'backgroundTransparent',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: badge.id, name: 'padding', type: 'dimension' as const, defaultValue: '', description: '' },
            { componentId: badge.id, name: 'height', type: 'dimension' as const, defaultValue: '', description: '' },
            { componentId: badge.id, name: 'shape', type: 'shape' as const, defaultValue: '', description: '' },
            {
                componentId: badge.id,
                name: 'backgroundClear',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: badge.id,
                name: 'leftContentMarginRight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: badge.id,
                name: 'rightContentMarginLeft',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },

            // ── Spinner ──────────────────────────────────────────────────────────
            { componentId: spinner.id, name: 'color', type: 'color' as const, defaultValue: '', description: '' },
            { componentId: spinner.id, name: 'size', type: 'dimension' as const, defaultValue: '', description: '' },

            // ── Chip ──────────────────────────────────────────────────────────
            { componentId: chip.id, name: 'background', type: 'color' as const, defaultValue: '', description: '' },
            { componentId: chip.id, name: 'color', type: 'color' as const, defaultValue: '', description: '' },
            { componentId: chip.id, name: 'colorReadOnly', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: chip.id,
                name: 'outlineSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: chip.id,
                name: 'closeIconColorReadonly',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: chip.id, name: 'width', type: 'dimension' as const, defaultValue: '', description: '' },
            { componentId: chip.id, name: 'padding', type: 'dimension' as const, defaultValue: '', description: '' },
            {
                componentId: chip.id,
                name: 'leftContentMarginRight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: chip.id,
                name: 'rightContentMarginRight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: chip.id,
                name: 'clearContentMarginRight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: chip.id, name: 'disableAlpha', type: 'float' as const, defaultValue: '', description: '' },
            { componentId: chip.id, name: 'shape', type: 'shape' as const, defaultValue: '', description: '' },
            {
                componentId: chip.id,
                name: 'backgroundReadOnly',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: chip.id, name: 'focusColor', type: 'color' as const, defaultValue: '', description: '' },
            { componentId: chip.id, name: 'closeIconColor', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: chip.id,
                name: 'leftContentColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: chip.id, name: 'height', type: 'dimension' as const, defaultValue: '', description: '' },
            {
                componentId: chip.id,
                name: 'closeIconSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: chip.id,
                name: 'leftContentMarginLeft',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: chip.id,
                name: 'rightContentMarginLeft',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: chip.id,
                name: 'clearContentMarginLeft',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: chip.id, name: 'textStyle', type: 'typography' as const, defaultValue: '', description: '' },

            // ── Switch ──────────────────────────────────────────────────────────
            {
                componentId: switchComponent.id,
                name: 'labelColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'labelOffset',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'descriptionColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'verticalGap',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackBorderWidthOn',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackBorderWidthOff',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackBorderRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackBackgroundColorOn',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackBackgroundColorOff',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackFocusColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbOffsetOn',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbOffsetOff',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbBorderRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbBorderColorOff',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbBorderColorOn',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbBorderWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbBackgroundColorOn',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbBackgroundColorOff',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'textStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackBorderColorOn',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'disableAlpha',
                type: 'float' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'trackBorderColorOff',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'descriptionStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'descriptionMaxLines',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbPressScale',
                type: 'float' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: switchComponent.id,
                name: 'thumbBoxShadow',
                type: 'shadow' as const,
                defaultValue: '',
                description: '',
            },

            // ── Skeleton ──────────────────────────────────────────────────────────
            {
                componentId: skeleton.id,
                name: 'visibleLineHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: skeleton.id,
                name: 'pulseDuration',
                type: 'float' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: skeleton.id,
                name: 'fadeOutColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: skeleton.id,
                name: 'shimmerDuration',
                type: 'float' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: skeleton.id,
                name: 'gradientColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: skeleton.id,
                name: 'fadeInColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: skeleton.id,
                name: 'lineHeight',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },

            // ── List ──────────────────────────────────────────────────────────
            { componentId: list.id, name: 'listGap', type: 'dimension' as const, defaultValue: '', description: '' },
            { componentId: list.id, name: 'listBackground', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: list.id,
                name: 'listPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemBorderRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemPaddingRight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemPaddingBottom',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemBorderColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemGap',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: list.id, name: 'listItemColor', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: list.id,
                name: 'listItemDividerColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listDisabledOpacity',
                type: 'float' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listBorderRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemBackground',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemPaddingLeft',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemPaddingTop',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemContentPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemBorderWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemFocusColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemDividerWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'listItemTightDifference',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: list.id,
                name: 'litItemStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },

            // ── LinkButton ──────────────────────────────────────────────────────────
            {
                componentId: linkButton.id,
                name: 'linkButtonTextColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonRightContentMargin',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonFocusColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'textStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonIconColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonTextPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonAdditionalContentMargin',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonSpinnerColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonLeftContentMargin',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonSpinnerSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonDisabledAlpha',
                type: 'float' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: linkButton.id,
                name: 'linkButtonBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },

            // ── EmbedIconButton ──────────────────────────────────────────────────────────
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonDisabledAlpha',
                type: 'float' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonFocusColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonLoadingBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonSpinnerColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonSpinnerSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'embedIconButtonWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: embedIconButton.id,
                name: 'textStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },

            // ── Cell ──────────────────────────────────────────────────────────
            { componentId: cell.id, name: 'cellColor', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: cell.id,
                name: 'cellPaddingLeftContent',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: cell.id,
                name: 'cellTextboxGap',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: cell.id, name: 'cellLabelColor', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: cell.id,
                name: 'cellSubtitleStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: cell.id,
                name: 'cellBackgroundColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: cell.id,
                name: 'cellPaddingContent',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: cell.id, name: 'cellGap', type: 'dimension' as const, defaultValue: '', description: '' },
            { componentId: cell.id, name: 'cellTitleColor', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: cell.id,
                name: 'cellLabelStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: cell.id,
                name: 'cellTitleStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: cell.id,
                name: 'cellPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: cell.id,
                name: 'cellPaddingRightContent',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            { componentId: cell.id, name: 'cellWidth', type: 'dimension' as const, defaultValue: '', description: '' },
            {
                componentId: cell.id,
                name: 'cellSubtitleColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },

            // ── Divider ──────────────────────────────────────────────────────────
            { componentId: divider.id, name: 'background', type: 'color' as const, defaultValue: '', description: '' },
            {
                componentId: divider.id,
                name: 'baseSideSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: divider.id,
                name: 'borderRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },

            // ── EmptyState ──────────────────────────────────────────────────────────
            {
                componentId: emptyState.id,
                name: 'borderRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: emptyState.id,
                name: 'buttonHeight',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: emptyState.id,
                name: 'buttonMargin',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: emptyState.id,
                name: 'descriptionMargin',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: emptyState.id,
                name: 'iconMargin',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: emptyState.id,
                name: 'padding',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: emptyState.id,
                name: 'textStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },

            // ── Accordion ──────────────────────────────────────────────────────────
            {
                componentId: accordion.id,
                name: 'accordionWidth',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemViewBorderRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemPaddingHorizontal',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemGap',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemHeaderLeftGap',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemTitleColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemTextStyle',
                type: 'typography' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemBorderBottom',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionBackground',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemShadow',
                type: 'shadow' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemPadding',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemPaddingHorizontalLeft',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemFocus',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemIconColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemHeaderLeftGapDefault',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemOpenedTitleColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionGap',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemBackground',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemBorderRadius',
                type: 'shape' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemPaddingVertical',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemBodyPaddingBottom',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemBorder',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemIconSize',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemHeaderLeftGapClear',
                type: 'dimension' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemTextColor',
                type: 'color' as const,
                defaultValue: '',
                description: '',
            },
            {
                componentId: accordion.id,
                name: 'accordionItemTitleStyle',
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
    // Indicator
    const findIndicator = (name: string) => rows.find((r: any) => r.componentId === indicator.id && r.name === name)!;
    addPlatformParams(findIndicator('size').id, { web: ['size'] });
    addPlatformParams(findIndicator('color').id, { web: ['color'] });
    // Badge
    const findBadge = (name: string) => rows.find((r: any) => r.componentId === badge.id && r.name === name)!;
    addPlatformParams(findBadge('textStyle').id, {
        web: ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight'],
    });
    addPlatformParams(findBadge('leftContentMarginLeft').id, { web: ['leftContentMarginLeft'] });
    addPlatformParams(findBadge('rightContentMarginRight').id, { web: ['rightContentMarginRight'] });
    addPlatformParams(findBadge('background').id, { web: ['background'] });
    addPlatformParams(findBadge('color').id, { web: ['color'] });
    addPlatformParams(findBadge('paddingIconOnly').id, { web: ['paddingIconOnly'] });
    addPlatformParams(findBadge('colorTransparent').id, { web: ['colorTransparent'] });
    addPlatformParams(findBadge('colorClear').id, { web: ['colorClear'] });
    addPlatformParams(findBadge('backgroundTransparent').id, { web: ['backgroundTransparent'] });
    addPlatformParams(findBadge('padding').id, { web: ['padding'] });
    addPlatformParams(findBadge('height').id, { web: ['height'] });
    addPlatformParams(findBadge('shape').id, { web: ['borderRadius'] });
    addPlatformParams(findBadge('backgroundClear').id, { web: ['backgroundClear'] });
    addPlatformParams(findBadge('leftContentMarginRight').id, { web: ['leftContentMarginRight'] });
    addPlatformParams(findBadge('rightContentMarginLeft').id, { web: ['rightContentMarginLeft'] });
    // Spinner
    const findSpinner = (name: string) => rows.find((r: any) => r.componentId === spinner.id && r.name === name)!;
    addPlatformParams(findSpinner('color').id, { web: ['color'] });
    addPlatformParams(findSpinner('size').id, { web: ['size'] });
    // Chip
    const findChip = (name: string) => rows.find((r: any) => r.componentId === chip.id && r.name === name)!;
    addPlatformParams(findChip('background').id, { web: ['background'] });
    addPlatformParams(findChip('color').id, { web: ['color'] });
    addPlatformParams(findChip('colorReadOnly').id, { web: ['colorReadOnly'] });
    addPlatformParams(findChip('outlineSize').id, { web: ['outlineSize'] });
    addPlatformParams(findChip('closeIconColorReadonly').id, { web: ['closeIconColorReadonly'] });
    addPlatformParams(findChip('width').id, { web: ['width'] });
    addPlatformParams(findChip('padding').id, { web: ['padding'] });
    addPlatformParams(findChip('leftContentMarginRight').id, { web: ['leftContentMarginRight'] });
    addPlatformParams(findChip('rightContentMarginRight').id, { web: ['rightContentMarginRight'] });
    addPlatformParams(findChip('clearContentMarginRight').id, { web: ['clearContentMarginRight'] });
    addPlatformParams(findChip('disableAlpha').id, { web: ['disabledOpacity'] });
    addPlatformParams(findChip('shape').id, { web: ['borderRadius'] });
    addPlatformParams(findChip('backgroundReadOnly').id, { web: ['backgroundReadOnly'] });
    addPlatformParams(findChip('focusColor').id, { web: ['focusColor'] });
    addPlatformParams(findChip('closeIconColor').id, { web: ['closeIconColor'] });
    addPlatformParams(findChip('leftContentColor').id, { web: ['leftContentColor'] });
    addPlatformParams(findChip('height').id, { web: ['height'] });
    addPlatformParams(findChip('closeIconSize').id, { web: ['closeIconSize'] });
    addPlatformParams(findChip('leftContentMarginLeft').id, { web: ['leftContentMarginLeft'] });
    addPlatformParams(findChip('rightContentMarginLeft').id, { web: ['rightContentMarginLeft'] });
    addPlatformParams(findChip('clearContentMarginLeft').id, { web: ['clearContentMarginLeft'] });
    addPlatformParams(findChip('textStyle').id, {
        web: ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight'],
    });
    // Switch
    const findSwitch = (name: string) =>
        rows.find((r: any) => r.componentId === switchComponent.id && r.name === name)!;
    addPlatformParams(findSwitch('labelColor').id, { web: ['labelColor'] });
    addPlatformParams(findSwitch('labelOffset').id, { web: ['labelOffset'] });
    addPlatformParams(findSwitch('descriptionColor').id, { web: ['descriptionColor'] });
    addPlatformParams(findSwitch('verticalGap').id, { web: ['verticalGap'] });
    addPlatformParams(findSwitch('trackWidth').id, { web: ['trackWidth'] });
    addPlatformParams(findSwitch('trackHeight').id, { web: ['trackHeight'] });
    addPlatformParams(findSwitch('trackBorderWidthOn').id, { web: ['trackBorderWidthOn'] });
    addPlatformParams(findSwitch('trackBorderWidthOff').id, { web: ['trackBorderWidthOff'] });
    addPlatformParams(findSwitch('trackBorderRadius').id, { web: ['trackBorderRadius'] });
    addPlatformParams(findSwitch('trackBackgroundColorOn').id, { web: ['trackBackgroundColorOn'] });
    addPlatformParams(findSwitch('trackBackgroundColorOff').id, { web: ['trackBackgroundColorOff'] });
    addPlatformParams(findSwitch('trackFocusColor').id, { web: ['trackFocusColor'] });
    addPlatformParams(findSwitch('thumbSize').id, { web: ['thumbSize'] });
    addPlatformParams(findSwitch('thumbOffsetOn').id, { web: ['thumbOffsetOn'] });
    addPlatformParams(findSwitch('thumbOffsetOff').id, { web: ['thumbOffsetOff'] });
    addPlatformParams(findSwitch('thumbBorderRadius').id, { web: ['thumbBorderRadius'] });
    addPlatformParams(findSwitch('thumbBorderColorOff').id, { web: ['thumbBorderColorOff'] });
    addPlatformParams(findSwitch('thumbBorderColorOn').id, { web: ['thumbBorderColorOn'] });
    addPlatformParams(findSwitch('thumbBorderWidth').id, { web: ['thumbBorderWidth'] });
    addPlatformParams(findSwitch('thumbBackgroundColorOn').id, { web: ['thumbBackgroundColorOn'] });
    addPlatformParams(findSwitch('thumbBackgroundColorOff').id, { web: ['thumbBackgroundColorOff'] });
    addPlatformParams(findSwitch('textStyle').id, {
        web: ['fontFamily', 'fontStyle', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'],
    });
    addPlatformParams(findSwitch('trackBorderColorOn').id, { web: ['trackBorderColorOn'] });
    addPlatformParams(findSwitch('disableAlpha').id, { web: ['disabledOpacity'] });
    addPlatformParams(findSwitch('trackBorderColorOff').id, { web: ['trackBorderColorOff'] });
    addPlatformParams(findSwitch('descriptionStyle').id, {
        web: [
            'descriptionFontFamily',
            'descriptionFontStyle',
            'descriptionFontSize',
            'descriptionFontWeight',
            'descriptionLetterSpacing',
            'descriptionLineHeight',
        ],
    });
    addPlatformParams(findSwitch('descriptionMaxLines').id, { web: ['descriptionMaxLines'] });
    addPlatformParams(findSwitch('thumbPressScale').id, { web: ['thumbScale'] });
    addPlatformParams(findSwitch('thumbBoxShadow').id, { web: ['thumbBoxShadow'] });
    // Skeleton
    const findSkeleton = (name: string) => rows.find((r: any) => r.componentId === skeleton.id && r.name === name)!;
    addPlatformParams(findSkeleton('visibleLineHeight').id, { web: ['visibleLineHeight'] });
    addPlatformParams(findSkeleton('pulseDuration').id, { web: ['pulseDuration'] });
    addPlatformParams(findSkeleton('fadeOutColor').id, { web: ['fadeOutColor'] });
    addPlatformParams(findSkeleton('shimmerDuration').id, { web: ['shimmerDuration'] });
    addPlatformParams(findSkeleton('gradientColor').id, { web: ['gradientColor'] });
    addPlatformParams(findSkeleton('fadeInColor').id, { web: ['fadeInColor'] });
    addPlatformParams(findSkeleton('lineHeight').id, { web: ['lineHeight'] });
    // List
    const findList = (name: string) => rows.find((r: any) => r.componentId === list.id && r.name === name)!;
    addPlatformParams(findList('listGap').id, { web: ['listGap'] });
    addPlatformParams(findList('listBackground').id, { web: ['listBackground'] });
    addPlatformParams(findList('listPadding').id, { web: ['listPadding'] });
    addPlatformParams(findList('listItemBorderRadius').id, { web: ['listItemBorderRadius'] });
    addPlatformParams(findList('listItemPaddingRight').id, { web: ['listItemPaddingRight'] });
    addPlatformParams(findList('listItemPaddingBottom').id, { web: ['listItemPaddingBottom'] });
    addPlatformParams(findList('listItemBorderColor').id, { web: ['listItemBorderColor'] });
    addPlatformParams(findList('listItemGap').id, { web: ['listItemGap'] });
    addPlatformParams(findList('listItemColor').id, { web: ['listItemColor'] });
    addPlatformParams(findList('listItemDividerColor').id, { web: ['listItemDividerColor'] });
    addPlatformParams(findList('listDisabledOpacity').id, { web: ['listDisabledOpacity'] });
    addPlatformParams(findList('listBorderRadius').id, { web: ['listBorderRadius'] });
    addPlatformParams(findList('listItemBackground').id, { web: ['listItemBackground'] });
    addPlatformParams(findList('listItemPaddingLeft').id, { web: ['listItemPaddingLeft'] });
    addPlatformParams(findList('listItemPaddingTop').id, { web: ['listItemPaddingTop'] });
    addPlatformParams(findList('listItemContentPadding').id, { web: ['listItemContentPadding'] });
    addPlatformParams(findList('listItemBorderWidth').id, { web: ['listItemBorderWidth'] });
    addPlatformParams(findList('listItemFocusColor').id, { web: ['listItemFocusColor'] });
    addPlatformParams(findList('listItemDividerWidth').id, { web: ['listItemDividerWidth'] });
    addPlatformParams(findList('listItemTightDifference').id, { web: ['listItemTightDifference'] });
    addPlatformParams(findList('litItemStyle').id, {
        web: [
            'listItemFontFamily',
            'listItemFontSize',
            'listItemFontStyle',
            'listItemFontWeight',
            'listItemLetterSpacing',
            'listItemLineHeight',
        ],
    });
    // LinkButton
    const findLinkButton = (name: string) => rows.find((r: any) => r.componentId === linkButton.id && r.name === name)!;
    addPlatformParams(findLinkButton('linkButtonTextColor').id, { web: ['linkButtonTextColor'] });
    addPlatformParams(findLinkButton('linkButtonPadding').id, { web: ['linkButtonPadding'] });
    addPlatformParams(findLinkButton('linkButtonRadius').id, { web: ['linkButtonRadius'] });
    addPlatformParams(findLinkButton('linkButtonRightContentMargin').id, { web: ['linkButtonRightContentMargin'] });
    addPlatformParams(findLinkButton('linkButtonFocusColor').id, { web: ['linkButtonFocusColor'] });
    addPlatformParams(findLinkButton('textStyle').id, {
        web: [
            'linkButtonFontSize',
            'linkButtonLetterSpacing',
            'linkButtonFontStyle',
            'linkButtonFontFamily',
            'linkButtonFontWeight',
            'linkButtonLineHeight',
        ],
    });
    addPlatformParams(findLinkButton('linkButtonIconColor').id, { web: ['linkButtonIconColor'] });
    addPlatformParams(findLinkButton('linkButtonHeight').id, { web: ['linkButtonHeight'] });
    addPlatformParams(findLinkButton('linkButtonTextPadding').id, { web: ['linkButtonTextPadding'] });
    addPlatformParams(findLinkButton('linkButtonAdditionalContentMargin').id, {
        web: ['linkButtonAdditionalContentMargin'],
    });
    addPlatformParams(findLinkButton('linkButtonSpinnerColor').id, { web: ['linkButtonSpinnerColor'] });
    addPlatformParams(findLinkButton('linkButtonLeftContentMargin').id, { web: ['linkButtonLeftContentMargin'] });
    addPlatformParams(findLinkButton('linkButtonSpinnerSize').id, { web: ['linkButtonSpinnerSize'] });
    addPlatformParams(findLinkButton('linkButtonDisabledAlpha').id, { web: ['linkButtonDisabledOpacity'] });
    addPlatformParams(findLinkButton('linkButtonColor').id, { web: ['linkButtonColor'] });
    addPlatformParams(findLinkButton('linkButtonBackgroundColor').id, { web: ['linkButtonBackgroundColor'] });
    // EmbedIconButton
    const findEmbedIconButton = (name: string) =>
        rows.find((r: any) => r.componentId === embedIconButton.id && r.name === name)!;
    addPlatformParams(findEmbedIconButton('embedIconButtonBackgroundColor').id, {
        web: ['embedIconButtonBackgroundColor'],
    });
    addPlatformParams(findEmbedIconButton('embedIconButtonColor').id, { web: ['embedIconButtonColor'] });
    addPlatformParams(findEmbedIconButton('embedIconButtonDisabledAlpha').id, {
        web: ['embedIconButtonDisabledOpacity'],
    });
    addPlatformParams(findEmbedIconButton('embedIconButtonFocusColor').id, { web: ['embedIconButtonFocusColor'] });
    addPlatformParams(findEmbedIconButton('embedIconButtonHeight').id, { web: ['embedIconButtonHeight'] });
    addPlatformParams(findEmbedIconButton('embedIconButtonLoadingBackgroundColor').id, {
        web: ['embedIconButtonLoadingBackgroundColor'],
    });
    addPlatformParams(findEmbedIconButton('embedIconButtonPadding').id, { web: ['embedIconButtonPadding'] });
    addPlatformParams(findEmbedIconButton('embedIconButtonRadius').id, { web: ['embedIconButtonRadius'] });
    addPlatformParams(findEmbedIconButton('embedIconButtonSpinnerColor').id, { web: ['embedIconButtonSpinnerColor'] });
    addPlatformParams(findEmbedIconButton('embedIconButtonSpinnerSize').id, { web: ['embedIconButtonSpinnerSize'] });
    addPlatformParams(findEmbedIconButton('embedIconButtonWidth').id, { web: ['embedIconButtonWidth'] });
    addPlatformParams(findEmbedIconButton('textStyle').id, {
        web: [
            'embedIconButtonFontFamily',
            'embedIconButtonFontSize',
            'embedIconButtonLineHeight',
            'embedIconButtonLetterSpacing',
            'embedIconButtonFontStyle',
            'embedIconButtonFontWeight',
        ],
    });
    // Cell
    const findCell = (name: string) => rows.find((r: any) => r.componentId === cell.id && r.name === name)!;
    addPlatformParams(findCell('cellColor').id, { web: ['cellColor'] });
    addPlatformParams(findCell('cellPaddingLeftContent').id, { web: ['cellPaddingLeftContent'] });
    addPlatformParams(findCell('cellTextboxGap').id, { web: ['cellTextboxGap'] });
    addPlatformParams(findCell('cellLabelColor').id, { web: ['cellLabelColor'] });
    addPlatformParams(findCell('cellSubtitleStyle').id, {
        web: [
            'cellSubtitleFontSize',
            'cellSubtitleLetterSpacing',
            'cellSubtitleFontFamily',
            'cellSubtitleFontStyle',
            'cellSubtitleFontWeight',
            'cellSubtitleLineHeight',
        ],
    });
    addPlatformParams(findCell('cellBackgroundColor').id, { web: ['cellBackgroundColor'] });
    addPlatformParams(findCell('cellPaddingContent').id, { web: ['cellPaddingContent'] });
    addPlatformParams(findCell('cellGap').id, { web: ['cellGap'] });
    addPlatformParams(findCell('cellTitleColor').id, { web: ['cellTitleColor'] });
    addPlatformParams(findCell('cellLabelStyle').id, {
        web: [
            'cellLabelFontFamily',
            'cellLabelFontWeight',
            'cellLabelFontSize',
            'cellLabelFontStyle',
            'cellLabelLetterSpacing',
            'cellLabelLineHeight',
        ],
    });
    addPlatformParams(findCell('cellTitleStyle').id, {
        web: [
            'cellTitleFontStyle',
            'cellTitleLineHeight',
            'cellTitleFontFamily',
            'cellTitleFontSize',
            'cellTitleFontWeight',
            'cellTitleLetterSpacing',
        ],
    });
    addPlatformParams(findCell('cellPadding').id, { web: ['cellPadding'] });
    addPlatformParams(findCell('cellPaddingRightContent').id, { web: ['cellPaddingRightContent'] });
    addPlatformParams(findCell('cellWidth').id, { web: ['cellWidth'] });
    addPlatformParams(findCell('cellSubtitleColor').id, { web: ['cellSubtitleColor'] });
    // Divider
    const findDivider = (name: string) => rows.find((r: any) => r.componentId === divider.id && r.name === name)!;
    addPlatformParams(findDivider('background').id, { web: ['background'] });
    addPlatformParams(findDivider('baseSideSize').id, { web: ['baseSideSize'] });
    addPlatformParams(findDivider('borderRadius').id, { web: ['borderRadius'] });
    // EmptyState
    const findEmptyState = (name: string) => rows.find((r: any) => r.componentId === emptyState.id && r.name === name)!;
    addPlatformParams(findEmptyState('borderRadius').id, { web: ['borderRadius'] });
    addPlatformParams(findEmptyState('buttonHeight').id, { web: ['buttonHeight'] });
    addPlatformParams(findEmptyState('buttonMargin').id, { web: ['buttonMargin'] });
    addPlatformParams(findEmptyState('descriptionMargin').id, { web: ['descriptionMargin'] });
    addPlatformParams(findEmptyState('iconMargin').id, { web: ['iconMargin'] });
    addPlatformParams(findEmptyState('padding').id, { web: ['padding'] });
    addPlatformParams(findEmptyState('textStyle').id, {
        web: ['fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'fontLetterSpacing', 'fontLineHeight'],
    });
    // Accordion
    const findAccordion = (name: string) => rows.find((r: any) => r.componentId === accordion.id && r.name === name)!;
    addPlatformParams(findAccordion('accordionWidth').id, { web: ['accordionWidth'] });
    addPlatformParams(findAccordion('accordionItemViewBorderRadius').id, { web: ['accordionItemViewBorderRadius'] });
    addPlatformParams(findAccordion('accordionItemPaddingHorizontal').id, { web: ['accordionItemPaddingHorizontal'] });
    addPlatformParams(findAccordion('accordionItemGap').id, { web: ['accordionItemGap'] });
    addPlatformParams(findAccordion('accordionItemHeaderLeftGap').id, { web: ['accordionItemHeaderLeftGap'] });
    addPlatformParams(findAccordion('accordionItemTitleColor').id, { web: ['accordionItemTitleColor'] });
    addPlatformParams(findAccordion('accordionItemTextStyle').id, {
        web: [
            'accordionItemTextFontFamily',
            'accordionItemTextFontStyle',
            'accordionItemTextFontSize',
            'accordionItemTextFontWeight',
            'accordionItemTextLetterSpacing',
            'accordionItemTextLineHeight',
        ],
    });
    addPlatformParams(findAccordion('accordionItemBorderBottom').id, { web: ['accordionItemBorderBottom'] });
    addPlatformParams(findAccordion('accordionBackground').id, { web: ['accordionBackground'] });
    addPlatformParams(findAccordion('accordionItemShadow').id, { web: ['accordionItemShadow'] });
    addPlatformParams(findAccordion('accordionItemPadding').id, { web: ['accordionItemPadding'] });
    addPlatformParams(findAccordion('accordionItemPaddingHorizontalLeft').id, {
        web: ['accordionItemPaddingHorizontalLeft'],
    });
    addPlatformParams(findAccordion('accordionItemFocus').id, { web: ['accordionItemFocus'] });
    addPlatformParams(findAccordion('accordionItemIconColor').id, { web: ['accordionItemIconColor'] });
    addPlatformParams(findAccordion('accordionItemHeaderLeftGapDefault').id, {
        web: ['accordionItemHeaderLeftGapDefault'],
    });
    addPlatformParams(findAccordion('accordionItemOpenedTitleColor').id, { web: ['accordionItemOpenedTitleColor'] });
    addPlatformParams(findAccordion('accordionGap').id, { web: ['accordionGap'] });
    addPlatformParams(findAccordion('accordionItemBackground').id, { web: ['accordionItemBackground'] });
    addPlatformParams(findAccordion('accordionItemBorderRadius').id, { web: ['accordionItemBorderRadius'] });
    addPlatformParams(findAccordion('accordionItemPaddingVertical').id, { web: ['accordionItemPaddingVertical'] });
    addPlatformParams(findAccordion('accordionItemBodyPaddingBottom').id, { web: ['accordionItemBodyPaddingBottom'] });
    addPlatformParams(findAccordion('accordionItemBorder').id, { web: ['accordionItemBorder'] });
    addPlatformParams(findAccordion('accordionItemIconSize').id, { web: ['accordionItemIconSize'] });
    addPlatformParams(findAccordion('accordionItemHeaderLeftGapClear').id, {
        web: ['accordionItemHeaderLeftGapClear'],
    });
    addPlatformParams(findAccordion('accordionItemTextColor').id, { web: ['accordionItemTextColor'] });
    addPlatformParams(findAccordion('accordionItemTitleStyle').id, {
        web: [
            'accordionItemTitleFontFamily',
            'accordionItemTitleFontSize',
            'accordionItemTitleFontWeight',
            'accordionItemTitleLetterSpacing',
            'accordionItemTitleLineHeight',
        ],
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
        // Indicator
        ind_size: findIndicator('size'),
        ind_color: findIndicator('color'),
        // Badge
        bad_textStyle: findBadge('textStyle'),
        bad_leftContentMarginLeft: findBadge('leftContentMarginLeft'),
        bad_rightContentMarginRight: findBadge('rightContentMarginRight'),
        bad_background: findBadge('background'),
        bad_color: findBadge('color'),
        bad_paddingIconOnly: findBadge('paddingIconOnly'),
        bad_colorTransparent: findBadge('colorTransparent'),
        bad_colorClear: findBadge('colorClear'),
        bad_backgroundTransparent: findBadge('backgroundTransparent'),
        bad_padding: findBadge('padding'),
        bad_height: findBadge('height'),
        bad_shape: findBadge('shape'),
        bad_backgroundClear: findBadge('backgroundClear'),
        bad_leftContentMarginRight: findBadge('leftContentMarginRight'),
        bad_rightContentMarginLeft: findBadge('rightContentMarginLeft'),
        // Spinner
        spi_color: findSpinner('color'),
        spi_size: findSpinner('size'),
        // Chip
        chi_background: findChip('background'),
        chi_color: findChip('color'),
        chi_colorReadOnly: findChip('colorReadOnly'),
        chi_outlineSize: findChip('outlineSize'),
        chi_closeIconColorReadonly: findChip('closeIconColorReadonly'),
        chi_width: findChip('width'),
        chi_padding: findChip('padding'),
        chi_leftContentMarginRight: findChip('leftContentMarginRight'),
        chi_rightContentMarginRight: findChip('rightContentMarginRight'),
        chi_clearContentMarginRight: findChip('clearContentMarginRight'),
        chi_disableAlpha: findChip('disableAlpha'),
        chi_shape: findChip('shape'),
        chi_backgroundReadOnly: findChip('backgroundReadOnly'),
        chi_focusColor: findChip('focusColor'),
        chi_closeIconColor: findChip('closeIconColor'),
        chi_leftContentColor: findChip('leftContentColor'),
        chi_height: findChip('height'),
        chi_closeIconSize: findChip('closeIconSize'),
        chi_leftContentMarginLeft: findChip('leftContentMarginLeft'),
        chi_rightContentMarginLeft: findChip('rightContentMarginLeft'),
        chi_clearContentMarginLeft: findChip('clearContentMarginLeft'),
        chi_textStyle: findChip('textStyle'),
        // Switch
        swi_labelColor: findSwitch('labelColor'),
        swi_labelOffset: findSwitch('labelOffset'),
        swi_descriptionColor: findSwitch('descriptionColor'),
        swi_verticalGap: findSwitch('verticalGap'),
        swi_trackWidth: findSwitch('trackWidth'),
        swi_trackHeight: findSwitch('trackHeight'),
        swi_trackBorderWidthOn: findSwitch('trackBorderWidthOn'),
        swi_trackBorderWidthOff: findSwitch('trackBorderWidthOff'),
        swi_trackBorderRadius: findSwitch('trackBorderRadius'),
        swi_trackBackgroundColorOn: findSwitch('trackBackgroundColorOn'),
        swi_trackBackgroundColorOff: findSwitch('trackBackgroundColorOff'),
        swi_trackFocusColor: findSwitch('trackFocusColor'),
        swi_thumbSize: findSwitch('thumbSize'),
        swi_thumbOffsetOn: findSwitch('thumbOffsetOn'),
        swi_thumbOffsetOff: findSwitch('thumbOffsetOff'),
        swi_thumbBorderRadius: findSwitch('thumbBorderRadius'),
        swi_thumbBorderColorOff: findSwitch('thumbBorderColorOff'),
        swi_thumbBorderColorOn: findSwitch('thumbBorderColorOn'),
        swi_thumbBorderWidth: findSwitch('thumbBorderWidth'),
        swi_thumbBackgroundColorOn: findSwitch('thumbBackgroundColorOn'),
        swi_thumbBackgroundColorOff: findSwitch('thumbBackgroundColorOff'),
        swi_textStyle: findSwitch('textStyle'),
        swi_trackBorderColorOn: findSwitch('trackBorderColorOn'),
        swi_disableAlpha: findSwitch('disableAlpha'),
        swi_trackBorderColorOff: findSwitch('trackBorderColorOff'),
        swi_descriptionStyle: findSwitch('descriptionStyle'),
        swi_descriptionMaxLines: findSwitch('descriptionMaxLines'),
        swi_thumbPressScale: findSwitch('thumbPressScale'),
        swi_thumbBoxShadow: findSwitch('thumbBoxShadow'),
        // Skeleton
        ske_visibleLineHeight: findSkeleton('visibleLineHeight'),
        ske_pulseDuration: findSkeleton('pulseDuration'),
        ske_fadeOutColor: findSkeleton('fadeOutColor'),
        ske_shimmerDuration: findSkeleton('shimmerDuration'),
        ske_gradientColor: findSkeleton('gradientColor'),
        ske_fadeInColor: findSkeleton('fadeInColor'),
        ske_lineHeight: findSkeleton('lineHeight'),
        // List
        lis_listGap: findList('listGap'),
        lis_listBackground: findList('listBackground'),
        lis_listPadding: findList('listPadding'),
        lis_listItemBorderRadius: findList('listItemBorderRadius'),
        lis_listItemPaddingRight: findList('listItemPaddingRight'),
        lis_listItemPaddingBottom: findList('listItemPaddingBottom'),
        lis_listItemBorderColor: findList('listItemBorderColor'),
        lis_listItemGap: findList('listItemGap'),
        lis_listItemColor: findList('listItemColor'),
        lis_listItemDividerColor: findList('listItemDividerColor'),
        lis_listDisabledOpacity: findList('listDisabledOpacity'),
        lis_listBorderRadius: findList('listBorderRadius'),
        lis_listItemBackground: findList('listItemBackground'),
        lis_listItemPaddingLeft: findList('listItemPaddingLeft'),
        lis_listItemPaddingTop: findList('listItemPaddingTop'),
        lis_listItemContentPadding: findList('listItemContentPadding'),
        lis_listItemBorderWidth: findList('listItemBorderWidth'),
        lis_listItemFocusColor: findList('listItemFocusColor'),
        lis_listItemDividerWidth: findList('listItemDividerWidth'),
        lis_listItemTightDifference: findList('listItemTightDifference'),
        lis_litItemStyle: findList('litItemStyle'),
        // LinkButton
        lin_linkButtonTextColor: findLinkButton('linkButtonTextColor'),
        lin_linkButtonPadding: findLinkButton('linkButtonPadding'),
        lin_linkButtonRadius: findLinkButton('linkButtonRadius'),
        lin_linkButtonRightContentMargin: findLinkButton('linkButtonRightContentMargin'),
        lin_linkButtonFocusColor: findLinkButton('linkButtonFocusColor'),
        lin_textStyle: findLinkButton('textStyle'),
        lin_linkButtonIconColor: findLinkButton('linkButtonIconColor'),
        lin_linkButtonHeight: findLinkButton('linkButtonHeight'),
        lin_linkButtonTextPadding: findLinkButton('linkButtonTextPadding'),
        lin_linkButtonAdditionalContentMargin: findLinkButton('linkButtonAdditionalContentMargin'),
        lin_linkButtonSpinnerColor: findLinkButton('linkButtonSpinnerColor'),
        lin_linkButtonLeftContentMargin: findLinkButton('linkButtonLeftContentMargin'),
        lin_linkButtonSpinnerSize: findLinkButton('linkButtonSpinnerSize'),
        lin_linkButtonDisabledAlpha: findLinkButton('linkButtonDisabledAlpha'),
        lin_linkButtonColor: findLinkButton('linkButtonColor'),
        lin_linkButtonBackgroundColor: findLinkButton('linkButtonBackgroundColor'),
        // EmbedIconButton
        emb_embedIconButtonBackgroundColor: findEmbedIconButton('embedIconButtonBackgroundColor'),
        emb_embedIconButtonColor: findEmbedIconButton('embedIconButtonColor'),
        emb_embedIconButtonDisabledAlpha: findEmbedIconButton('embedIconButtonDisabledAlpha'),
        emb_embedIconButtonFocusColor: findEmbedIconButton('embedIconButtonFocusColor'),
        emb_embedIconButtonHeight: findEmbedIconButton('embedIconButtonHeight'),
        emb_embedIconButtonLoadingBackgroundColor: findEmbedIconButton('embedIconButtonLoadingBackgroundColor'),
        emb_embedIconButtonPadding: findEmbedIconButton('embedIconButtonPadding'),
        emb_embedIconButtonRadius: findEmbedIconButton('embedIconButtonRadius'),
        emb_embedIconButtonSpinnerColor: findEmbedIconButton('embedIconButtonSpinnerColor'),
        emb_embedIconButtonSpinnerSize: findEmbedIconButton('embedIconButtonSpinnerSize'),
        emb_embedIconButtonWidth: findEmbedIconButton('embedIconButtonWidth'),
        emb_textStyle: findEmbedIconButton('textStyle'),
        // Cell
        cel_cellColor: findCell('cellColor'),
        cel_cellPaddingLeftContent: findCell('cellPaddingLeftContent'),
        cel_cellTextboxGap: findCell('cellTextboxGap'),
        cel_cellLabelColor: findCell('cellLabelColor'),
        cel_cellSubtitleStyle: findCell('cellSubtitleStyle'),
        cel_cellBackgroundColor: findCell('cellBackgroundColor'),
        cel_cellPaddingContent: findCell('cellPaddingContent'),
        cel_cellGap: findCell('cellGap'),
        cel_cellTitleColor: findCell('cellTitleColor'),
        cel_cellLabelStyle: findCell('cellLabelStyle'),
        cel_cellTitleStyle: findCell('cellTitleStyle'),
        cel_cellPadding: findCell('cellPadding'),
        cel_cellPaddingRightContent: findCell('cellPaddingRightContent'),
        cel_cellWidth: findCell('cellWidth'),
        cel_cellSubtitleColor: findCell('cellSubtitleColor'),
        // Divider
        div_background: findDivider('background'),
        div_baseSideSize: findDivider('baseSideSize'),
        div_borderRadius: findDivider('borderRadius'),
        // EmptyState
        emp_borderRadius: findEmptyState('borderRadius'),
        emp_buttonHeight: findEmptyState('buttonHeight'),
        emp_buttonMargin: findEmptyState('buttonMargin'),
        emp_descriptionMargin: findEmptyState('descriptionMargin'),
        emp_iconMargin: findEmptyState('iconMargin'),
        emp_padding: findEmptyState('padding'),
        emp_textStyle: findEmptyState('textStyle'),
        // Accordion
        acc_accordionWidth: findAccordion('accordionWidth'),
        acc_accordionItemViewBorderRadius: findAccordion('accordionItemViewBorderRadius'),
        acc_accordionItemPaddingHorizontal: findAccordion('accordionItemPaddingHorizontal'),
        acc_accordionItemGap: findAccordion('accordionItemGap'),
        acc_accordionItemHeaderLeftGap: findAccordion('accordionItemHeaderLeftGap'),
        acc_accordionItemTitleColor: findAccordion('accordionItemTitleColor'),
        acc_accordionItemTextStyle: findAccordion('accordionItemTextStyle'),
        acc_accordionItemBorderBottom: findAccordion('accordionItemBorderBottom'),
        acc_accordionBackground: findAccordion('accordionBackground'),
        acc_accordionItemShadow: findAccordion('accordionItemShadow'),
        acc_accordionItemPadding: findAccordion('accordionItemPadding'),
        acc_accordionItemPaddingHorizontalLeft: findAccordion('accordionItemPaddingHorizontalLeft'),
        acc_accordionItemFocus: findAccordion('accordionItemFocus'),
        acc_accordionItemIconColor: findAccordion('accordionItemIconColor'),
        acc_accordionItemHeaderLeftGapDefault: findAccordion('accordionItemHeaderLeftGapDefault'),
        acc_accordionItemOpenedTitleColor: findAccordion('accordionItemOpenedTitleColor'),
        acc_accordionGap: findAccordion('accordionGap'),
        acc_accordionItemBackground: findAccordion('accordionItemBackground'),
        acc_accordionItemBorderRadius: findAccordion('accordionItemBorderRadius'),
        acc_accordionItemPaddingVertical: findAccordion('accordionItemPaddingVertical'),
        acc_accordionItemBodyPaddingBottom: findAccordion('accordionItemBodyPaddingBottom'),
        acc_accordionItemBorder: findAccordion('accordionItemBorder'),
        acc_accordionItemIconSize: findAccordion('accordionItemIconSize'),
        acc_accordionItemHeaderLeftGapClear: findAccordion('accordionItemHeaderLeftGapClear'),
        acc_accordionItemTextColor: findAccordion('accordionItemTextColor'),
        acc_accordionItemTitleStyle: findAccordion('accordionItemTitleStyle'),
    };

    console.log(`  properties: ${rows.length} rows`);
    return p;
}
