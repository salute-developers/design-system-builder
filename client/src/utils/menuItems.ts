import { getRestoredColorFromPalette, upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import {
    Config,
    ColorToken,
    GradientToken,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    Theme,
    TypographyToken,
} from '../controllers';
import { kebabToCamel } from './';
import { Data, DataItems, MenuType } from '../types';

// TODO: Перенести в БД
const componentList = [
    {
        groupName: 'Layout',
        components: [
            { name: 'Flow', disabled: true },
            { name: 'Grid', disabled: true },
        ],
    },
    {
        groupName: 'Data Display',
        components: [
            { name: 'Accordion', disabled: true },
            { name: 'Avatar', disabled: true },
            { name: 'AvatarGroup', disabled: true },
            { name: 'Badge', disabled: true },
            { name: 'Card', disabled: true },
            { name: 'Cell', disabled: true },
            { name: 'Chip', disabled: true },
            { name: 'ChipGroup', disabled: true },
            { name: 'Counter', disabled: true },
            { name: 'Divider', disabled: true },
            { name: 'Image', disabled: true },
            { name: 'Indicator', disabled: true },
            { name: 'InformationWrapper', disabled: true },
            { name: 'List', disabled: true },
            { name: 'Mask', disabled: true },
            { name: 'Note', disabled: true },
            { name: 'Price', disabled: true },
            { name: 'Rating', disabled: true },
            { name: 'Skeleton', disabled: true },
            { name: 'Spinner', disabled: true },
            { name: 'Table', disabled: true },
            { name: 'Typography', disabled: true },
            { name: 'ViewContainer', disabled: true },
        ],
    },
    {
        groupName: 'Data Entry',
        components: [
            { name: 'Attach', disabled: true },
            { name: 'Accordion', disabled: true },
            { name: 'Autocomplete', disabled: true },
            { name: 'Button', disabled: false },
            { name: 'ButtonGroup', disabled: true },
            { name: 'Calendar', disabled: true },
            { name: 'Checkbox', disabled: false },
            { name: 'CodeField', disabled: true },
            { name: 'Combobox', disabled: true },
            { name: 'DatePicker', disabled: true },
            { name: 'Dropdown', disabled: true },
            { name: 'Dropzone', disabled: true },
            { name: 'Editable', disabled: true },
            { name: 'EmbedIconButton', disabled: true },
            { name: 'EmptyState', disabled: true },
            { name: 'IconButton', disabled: false },
            { name: 'LinkButton', disabled: true },
            { name: 'NumberFormat', disabled: true },
            { name: 'NumberInput', disabled: true },
            { name: 'Portal', disabled: true },
            { name: 'Radiobox', disabled: false },
            { name: 'Range', disabled: true },
            { name: 'Rating', disabled: true },
            { name: 'Segment', disabled: true },
            { name: 'Select', disabled: true },
            { name: 'Slider', disabled: true },
            { name: 'Switch', disabled: true },
            { name: 'TextArea', disabled: true },
            { name: 'TextField', disabled: true },
            { name: 'TextFieldGroup', disabled: true },
            { name: 'TimePicker', disabled: true },
            { name: 'Tree', disabled: true },
        ],
    },
    {
        groupName: 'Navigation',
        components: [
            { name: 'Breadcrumbs', disabled: true },
            { name: 'Carousel', disabled: true },
            { name: 'Link', disabled: false },
            { name: 'Pagination', disabled: true },
            { name: 'PaginationDots', disabled: true },
            { name: 'Steps', disabled: true },
            { name: 'Tabs', disabled: true },
            { name: 'Tour', disabled: true },
        ],
    },
    {
        groupName: 'Overlay',
        components: [
            { name: 'Drawer', disabled: true },
            { name: 'Modal', disabled: true },
            { name: 'Notification', disabled: true },
            { name: 'Overlay', disabled: true },
            { name: 'Popover', disabled: true },
            { name: 'Popup', disabled: true },
            { name: 'Progress', disabled: true },
            { name: 'ProgressBarCircular', disabled: true },
            { name: 'Sheet', disabled: true },
            { name: 'Toast', disabled: true },
            { name: 'Toolbar', disabled: true },
            { name: 'Tooltip', disabled: true },
        ],
    },
];

const generateComponentMap = (componentConfigs: Config[]) => {
    const data: DataItems = {};

    const addToData = (components: typeof componentList) => {
        components.forEach((component) => {
            const tab = 'default';
            const mode = 'default';
            const group = component.groupName;

            component.components.forEach((component) => {
                const name = component.name;
                const enabled = !component.disabled;

                if (!data[tab]) {
                    data[tab] = {};
                }

                if (!data[tab][group]) {
                    data[tab][group] = {};
                }

                if (!data[tab][group][name]) {
                    data[tab][group][name] = {};
                }

                const item = componentConfigs.find((config) => config.getName() === name)!;

                data[tab][group][name][mode] = {
                    enabled,
                    value: null,
                    item,
                };
            });
        });
    };

    addToData(componentList);

    return data;
};

const generateColorTokensMap = (colors: ColorToken[], gradients: GradientToken[]) => {
    const data: DataItems = {};

    const addToData = (tokens: ColorToken[] | GradientToken[]) => {
        tokens
            .filter(
                (token) =>
                    !token.getName().includes('hover') &&
                    !token.getName().includes('active') &&
                    !token.getName().includes('brightness'),
            )
            .forEach((token) => {
                const [mode, group, subgroup] = token.getTags();
                const name = token.getDisplayName();
                const tab = subgroup === 'light' ? 'onLight' : subgroup === 'dark' ? 'onDark' : kebabToCamel(subgroup);

                const enabled = token.getEnabled();
                let value = '';
                if (token instanceof ColorToken) {
                    value = getRestoredColorFromPalette(token.getValue('web') as string, -1);
                }
                if (token instanceof GradientToken) {
                    value = token.getValue('web').join(' ');
                }

                if (!data[tab]) {
                    data[tab] = {};
                }

                if (!data[tab][group]) {
                    data[tab][group] = {};
                }

                if (!data[tab][group][name]) {
                    data[tab][group][name] = {};
                }

                data[tab][group][name][mode] = {
                    enabled,
                    value,
                    item: token,
                };
            });
    };

    addToData(colors);
    addToData(gradients);

    return data;
};

const generateTypographyTokensMap = (typography: TypographyToken[]) => {
    const data: DataItems = {};

    const addToData = (tokens: TypographyToken[]) => {
        tokens.forEach((token) => {
            const [mode, group] = token.getTags();
            const tab = 'default';
            const name = token.getDisplayName();

            const enabled = token.getEnabled();
            const value = `${parseFloat(token.getValue('web').fontSize) * 16}/${
                parseFloat(token.getValue('web').lineHeight) * 16
            }`;

            if (!data[tab]) {
                data[tab] = {};
            }

            if (!data[tab][group]) {
                data[tab][group] = {};
            }

            if (!data[tab][group][name]) {
                data[tab][group][name] = {};
            }

            data[tab][group][name][mode] = {
                enabled,
                value,
                item: token,
            };
        });
    };

    addToData(typography);

    return data;
};

const generateShapeTokensMap = (shapes: ShapeToken[], shadows: ShadowToken[], spacings: SpacingToken[]) => {
    const data: DataItems = {};

    const addToData = (tokens: ShapeToken[] | ShadowToken[] | SpacingToken[], group: string) => {
        tokens.forEach((token) => {
            const tab = 'default';
            const mode = 'default';
            const name = token.getDisplayName();

            const enabled = token.getEnabled();
            let value = '';
            if (token instanceof ShapeToken || token instanceof SpacingToken) {
                value = `${parseFloat(token.getValue('web')) * 16}px`;
            }

            if (!data[tab]) {
                data[tab] = {};
            }

            if (!data[tab][group]) {
                data[tab][group] = {};
            }

            if (!data[tab][group][name]) {
                data[tab][group][name] = {};
            }

            data[tab][group][name][mode] = {
                enabled,
                value,
                item: token,
            };
        });
    };

    addToData(shapes, 'shapes');
    addToData(shadows, 'shadows');
    addToData(spacings, 'spacings');

    return data;
};

const createDataItems = (dataItems: DataItems, tokenType: MenuType, tabsName?: string) => {
    const data: Data = {
        groups: [],
    };

    if (tabsName) {
        data.tabs = {
            name: tabsName,
            values: Object.keys(dataItems).map(upperFirstLetter),
        };
    }

    Object.entries(dataItems).forEach(([tab, groups]) => {
        data.groups.push({
            value: tabsName ? upperFirstLetter(tab) : undefined,
            data: Object.entries(groups).map(([group, items]) => ({
                name: upperFirstLetter(group),
                type: tokenType,
                items: Object.entries(items).map(([name, modes]) => {
                    const disabled = !Object.values(modes)[0].enabled;
                    const previewValues = Object.values(modes).map(({ value }) => value);
                    const data = Object.values(modes).map(({ item: token }) => token);

                    return {
                        name,
                        disabled,
                        previewValues,
                        data,
                    };
                }),
            })),
        });
    });

    return data;
};

export const getMenuItems = (data?: Theme | Config[], type?: MenuType): Data | undefined => {
    if (!data) {
        return undefined;
    }

    if (type === 'color' && data instanceof Theme) {
        const colors = data.getTokens('color');
        const gradients = data.getTokens('gradient');
        const colorTokens = generateColorTokensMap(colors, gradients);

        return createDataItems(colorTokens, 'color', 'Подтемы');
    }

    if (type === 'typography' && data instanceof Theme) {
        const typography = data.getTokens('typography');
        const typographyTokens = generateTypographyTokensMap(typography);

        return createDataItems(typographyTokens, 'typography');
    }

    if (type === 'shape' && data instanceof Theme) {
        const shapes = data.getTokens('shape');
        const shadows = data.getTokens('shadow');
        const spacings = data.getTokens('spacing');
        const shapeTokens = generateShapeTokensMap(shapes, shadows, spacings);

        return createDataItems(shapeTokens, 'shape');
    }

    if (type === 'components' && Array.isArray(data)) {
        const components = generateComponentMap(data);

        return createDataItems(components, 'components');
    }

    return {} as Data;
};
