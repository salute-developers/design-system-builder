// Копия `js/apps/client/src/stories/TextFieldGroup.story.tsx`: в клиенте story остаётся запасным React-превью,
// пока web-плагин не публикуется через бэкенд. Меняя одну, меняйте и другую.
import { component, mergeConfig, textFieldGroupConfig } from '@salutejs/plasma-new-hope/styled-components';

const TextFieldGroup = component(mergeConfig(textFieldGroupConfig as any, {}));

const TextFieldGroupDefault = {
    name: 'Default',
    args: [
        {
            name: 'itemsCount',
            value: 3,
        },
        {
            name: 'isCommonTextFieldStyles',
            value: true,
        },
    ],
    render: function Story({ relatedComponents, ...args }: any) {
        const { TextField } = relatedComponents;
        const { itemsCount, ...rest } = args;
        const count = Math.max(1, Number(itemsCount) || 1);

        return (
            <TextFieldGroup {...rest}>
                {Array.from({ length: count }, (_, i) => (
                    <TextField key={`item:${i}`} placeholder={`input #${i}`} />
                ))}
            </TextFieldGroup>
        );
    },
};

export const TextFieldGroupStories = [TextFieldGroupDefault];
