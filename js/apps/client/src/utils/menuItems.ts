import { getRestoredColorFromPalette, upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import {
    Config,
    Token,
    ColorToken,
    GradientToken,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    Theme,
    TypographyToken,
} from '../controllers';
import { kebabToCamel } from './';
import { Data, DataItems, GroupNode, MenuType } from '../types';

// TODO: Перенести в БД?
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
            { name: 'Accordion', disabled: false },
            { name: 'Avatar', disabled: false },
            { name: 'AvatarGroup', disabled: false },
            { name: 'Badge', disabled: false },
            { name: 'Card', disabled: false },
            { name: 'Cell', disabled: false },
            { name: 'Chip', disabled: false },
            { name: 'ChipGroup', disabled: false },
            { name: 'Counter', disabled: false },
            { name: 'Divider', disabled: false },
            { name: 'Image', disabled: false },
            { name: 'Indicator', disabled: false },
            { name: 'InformationWrapper', disabled: true },
            { name: 'List', disabled: false },
            { name: 'Mask', disabled: true },
            { name: 'Note', disabled: false },
            { name: 'Price', disabled: false },
            { name: 'Rating', disabled: false },
            { name: 'Skeleton', disabled: false },
            { name: 'Spinner', disabled: false },
            { name: 'Table', disabled: true },
            { name: 'Body', disabled: false },
            { name: 'Dspl', disabled: false },
            { name: 'Heading', disabled: false },
            { name: 'Text', disabled: false },
            { name: 'ViewContainer', disabled: true },
        ],
    },
    {
        groupName: 'Data Entry',
        components: [
            { name: 'Attach', disabled: true },
            { name: 'Autocomplete', disabled: true },
            { name: 'Button', disabled: false },
            { name: 'ButtonGroup', disabled: false },
            { name: 'Calendar', disabled: true },
            { name: 'Checkbox', disabled: false },
            { name: 'CodeField', disabled: true },
            { name: 'Combobox', disabled: false },
            { name: 'DatePicker', disabled: true },
            { name: 'Dropdown', disabled: false },
            { name: 'Dropzone', disabled: false },
            { name: 'Editable', disabled: true },
            { name: 'EmbedIconButton', disabled: false },
            { name: 'EmptyState', disabled: false },
            { name: 'IconButton', disabled: false },
            { name: 'LinkButton', disabled: false },
            { name: 'NumberFormat', disabled: true },
            { name: 'NumberInput', disabled: false },
            { name: 'Portal', disabled: true },
            { name: 'Radiobox', disabled: false },
            { name: 'Range', disabled: false },
            { name: 'SegmentGroup', disabled: false },
            { name: 'SegmentItem', disabled: false },
            { name: 'Select', disabled: false },
            { name: 'Slider', disabled: false },
            { name: 'Switch', disabled: false },
            { name: 'TextArea', disabled: false },
            { name: 'TextField', disabled: false },
            { name: 'TextFieldGroup', disabled: false },
            { name: 'TimePicker', disabled: true },
            { name: 'Tree', disabled: true },
        ],
    },
    {
        groupName: 'Navigation',
        components: [
            { name: 'Breadcrumbs', disabled: false },
            { name: 'Carousel', disabled: true },
            { name: 'Link', disabled: false },
            { name: 'Pagination', disabled: false },
            { name: 'Steps', disabled: false },
            { name: 'StepItem', disabled: false },
            { name: 'Tabs', disabled: false },
            { name: 'TabItem', disabled: false },
            { name: 'IconTabItem', disabled: false },
            { name: 'Tour', disabled: true },
        ],
    },
    {
        groupName: 'Overlay',
        components: [
            { name: 'Drawer', disabled: false },
            { name: 'Modal', disabled: false },
            { name: 'Notification', disabled: false },
            { name: 'Overlay', disabled: true },
            { name: 'Popover', disabled: false },
            { name: 'Popup', disabled: false },
            { name: 'Progress', disabled: false },
            { name: 'ProgressBarCircular', disabled: false },
            { name: 'Loader', disabled: false },
            { name: 'Sheet', disabled: false },
            { name: 'Toast', disabled: false },
            { name: 'Toolbar', disabled: false },
            { name: 'Tooltip', disabled: false },
        ],
    },
].sort((a, b) => a.groupName.localeCompare(b.groupName));

const generateComponentMap = (componentConfigs: Config[]) => {
    const data: DataItems = {};

    const addToData = (components: typeof componentList) => {
        components.forEach((component) => {
            const tab = 'default';
            const mode = 'default';
            const group = component.groupName;

            component.components.forEach((component) => {
                const name = component.name;
                const item = componentConfigs.find((config) => config.getName() === name);
                const enabled = !component.disabled && Boolean(item);

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
    const groups: GroupNode[] = [];

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

                const tab = subgroup === 'light' ? 'onLight' : subgroup === 'dark' ? 'onDark' : kebabToCamel(subgroup);

                const subgroupPrefix = kebabToCamel(subgroup);
                const displayName = token.getDisplayName();

                const name =
                    subgroup === 'default' || !displayName.startsWith(subgroupPrefix)
                        ? displayName
                        : displayName.charAt(subgroupPrefix.length).toLowerCase() +
                          displayName.slice(subgroupPrefix.length + 1);

                const enabled = token.getEnabled();
                let value = '';

                if (token instanceof ColorToken) {
                    value = getRestoredColorFromPalette(token.getValue('web') as string, -1);
                }
                if (token instanceof GradientToken) {
                    value = token.getValue('web').join(' ');
                }

                let groupNode = groups.find((node) => node.group === group);
                if (!groupNode) {
                    groupNode = { group, data: [] };
                    groups.push(groupNode);
                }

                let tokenNode = groupNode.data.find((node) => node.name === name);
                if (!tokenNode) {
                    tokenNode = { name, data: [] };
                    groupNode.data.push(tokenNode);
                }

                let subgroupNode = tokenNode.data.find((node) => node.subgroup === tab);
                if (!subgroupNode) {
                    subgroupNode = { subgroup: tab, data: [] };
                    tokenNode.data.push(subgroupNode);
                }

                subgroupNode.data.push({ mode, data: { enabled, value, item: token } });
            });
    };

    addToData(colors);
    addToData(gradients);

    groups.sort((a, b) => a.group.localeCompare(b.group));
    groups.forEach((groupNode) => {
        groupNode.data.sort((a, b) => a.name.localeCompare(b.name));
        groupNode.data.forEach((tokenNode) => {
            tokenNode.data.sort((a, b) => a.subgroup.localeCompare(b.subgroup));
            tokenNode.data.forEach((subgroupNode) => {
                subgroupNode.data.sort((a, b) => a.mode.localeCompare(b.mode));
            });
        });
    });

    return groups;
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
            values: Object.keys(dataItems)
                .map(upperFirstLetter)
                .sort((a, b) => a.localeCompare(b)),
        };
    }

    Object.entries(dataItems)
        .sort(([a], [b]) => upperFirstLetter(a).localeCompare(upperFirstLetter(b)))
        .forEach(([tab, groups]) => {
            data.groups.push({
                value: tabsName ? upperFirstLetter(tab) : undefined,
                data: Object.entries(groups)
                    .map(([group, items]) => ({
                        name: upperFirstLetter(group),
                        type: tokenType,
                        items: Object.entries(items)
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([name, modes]) => {
                                const disabled = !Object.values(modes)[0].enabled;
                                const previewValues = Object.values(modes).map(({ value }) => value);
                                const data = Object.values(modes)
                                    .map(({ item: token }) => token)
                                    .filter((token): token is Token | Config => Boolean(token));

                                return {
                                    name,
                                    disabled,
                                    previewValues,
                                    data,
                                };
                            }),
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name)),
            });
        });

    return data;
};

export const getMenuItems = (data?: Theme | Config[], type?: MenuType): GroupNode[] | undefined => {
    if (!data) {
        return undefined;
    }

    if (type === 'color' && data instanceof Theme) {
        const colors = data.getTokens('color');
        const gradients = data.getTokens('gradient');
        const colorTokens = generateColorTokensMap(colors, gradients);

        return colorTokens;
    }
};

export const getOldMenuItems = (data?: Theme | Config[], type?: MenuType): Data | undefined => {
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
