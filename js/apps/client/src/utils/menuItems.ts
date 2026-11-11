import type { Config } from '../controllers';
import type { ComposePreviewComponentGroup } from '../composePreview';

const OTHER_COMPONENTS_GROUP = 'Other';

// TODO: Перенести в БД?
/**
 * Группы меню по имени компонента для всех платформ. Имена Compose частично отличаются от web (`BasicButton` и
 * `Button`, `CheckBox` и `Checkbox`) и включают собственные компоненты; имя вне таблицы попадает в «Other».
 */
const componentGroupNames: Record<string, string[]> = {
    AI: ['AiAnswer', 'AiHeader', 'AiInput', 'AiUserMessage'],
    'Data Display': [
        'Accordion',
        'AccordionItem',
        'Avatar',
        'AvatarGroup',
        'Badge',
        'Body',
        'Card',
        'Cell',
        'Chip',
        'ChipGroup',
        'Counter',
        'Divider',
        'Dspl',
        'Heading',
        'IconBadge',
        'Image',
        'Indicator',
        'InformationWrapper',
        'List',
        'ListItem',
        'Mask',
        'Note',
        'NoteCompact',
        'Price',
        'Rating',
        'RectSkeleton',
        'Skeleton',
        'Spinner',
        'Table',
        'Text',
        'TextSkeleton',
        'ViewContainer',
    ],
    'Data Entry': [
        'Attach',
        'Autocomplete',
        'BasicButton',
        'Button',
        'ButtonBase',
        'ButtonGroup',
        'Calendar',
        'CalendarDouble',
        'CheckBox',
        'Checkbox',
        'CheckBoxGroup',
        'CodeArea',
        'CodeField',
        'CodeInput',
        'ComboBox',
        'Combobox',
        'DatePicker',
        'DateTimePicker',
        'Dropdown',
        'DropdownEmptyState',
        'DropdownLoadingState',
        'DropdownMenu',
        'Dropzone',
        'DropZone',
        'Editable',
        'EmbedIconButton',
        'EmptyState',
        'File',
        'FormItem',
        'Group',
        'IconButton',
        'LinkButton',
        'NumberFormat',
        'NumberInput',
        'RadioBox',
        'Radiobox',
        'RadioBoxGroup',
        'Range',
        'RatingInput',
        'Segment',
        'SegmentGroup',
        'SegmentItem',
        'Select',
        'SelectItem',
        'Slider',
        'Switch',
        'TextArea',
        'TextField',
        'TextFieldGroup',
        'TextFieldSlider',
        'TimePicker',
        'Tree',
        'Wheel',
    ],
    Layout: ['Flow', 'Grid', 'ScrollBar', 'Splitter'],
    Navigation: [
        'Breadcrumbs',
        'Carousel',
        'CollapsingNavigationBar',
        'IconTabItem',
        'Link',
        'NavigationBar',
        'NavigationDrawer',
        'NavigationDrawerItem',
        'Pagination',
        'PaginationDots',
        'StepItem',
        'Steps',
        'TabBar',
        'TabBarItem',
        'TabItem',
        'Tabs',
        'Tour',
    ],
    Overlay: [
        'CircularProgressBar',
        'Drawer',
        'Loader',
        'Modal',
        'ModalBottomSheet',
        'Notification',
        'NotificationContent',
        'Overlay',
        'Popover',
        'Popup',
        'Portal',
        'Progress',
        'ProgressBar',
        'ProgressBarCircular',
        'Sheet',
        'Toast',
        'ToolBar',
        'Toolbar',
        'Tooltip',
    ],
};

/** Web-компоненты, которые редактор пока не поддерживает: в меню не показываются. */
const unsupportedWebComponents = new Set(['Editable']);

/** Компонент платформы, который редактор показывает: неподдерживаемые web-компоненты в меню не попадают. */
export const isEditableComponent = (name: string, platform: string) =>
    platform !== 'web' || !unsupportedWebComponents.has(name);

export interface ComponentGroup {
    name: string;
    items: Config[];
}

/** Группа компонента: группы плагина сильнее таблицы клиента, имя вне таблиц попадает в «Other». */
const groupByName = (pluginGroups: ComposePreviewComponentGroup[] = []) =>
    new Map([
        ...Object.entries(componentGroupNames).flatMap(([group, names]) => names.map((name) => [name, group] as const)),
        ...pluginGroups.flatMap(({ name, components }) => components.map((component) => [component, name] as const)),
    ]);

export const getComponentGroup = (name: string, pluginGroups?: ComposePreviewComponentGroup[]) =>
    groupByName(pluginGroups).get(name) ?? OTHER_COMPONENTS_GROUP;

export const getComponentGroups = (
    componentConfigs: Config[],
    pluginGroups?: ComposePreviewComponentGroup[],
): ComponentGroup[] => {
    const names = groupByName(pluginGroups);
    const groups = new Map<string, Config[]>();

    componentConfigs
        .filter((item) => isEditableComponent(item.getName(), item.getPlatform()))
        .forEach((item) => {
            const group = names.get(item.getName()) ?? OTHER_COMPONENTS_GROUP;
            groups.set(group, [...(groups.get(group) ?? []), item]);
        });

    return [...groups]
        .map(([name, items]) => ({
            name,
            items: items.sort((a, b) => a.getName().localeCompare(b.getName())),
        }))
        .sort(
            (a, b) =>
                Number(a.name === OTHER_COMPONENTS_GROUP) - Number(b.name === OTHER_COMPONENTS_GROUP) ||
                a.name.localeCompare(b.name),
        );
};
