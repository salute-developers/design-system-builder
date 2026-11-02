// Копия `js/apps/client/src/stories/Divider.story.tsx`: в клиенте story остаётся запасным React-превью,
// пока web-плагин не публикуется через бэкенд. Меняя одну, меняйте и другую.
import styled from 'styled-components';
import { BodyS } from '@salutejs/plasma-b2c';
import { component, dividerConfig, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

const Divider = component(mergeConfig(dividerConfig as any, {}));

const StyledWrapper = styled.div<{ orientation?: string }>`
    display: inline-flex;
    gap: 0.5rem;
    padding: 1rem;
    background: #515151;
    align-items: center;
    justify-content: center;
    flex-direction: ${(props) => (props.orientation === 'horizontal' ? 'column' : 'row')};
`;

const DividerDefault = {
    name: 'Default',
    args: [
        {
            name: 'length',
            value: '100%',
        },
    ],
    render: function Story(args: any) {
        return (
            <StyledWrapper orientation={args.orientation}>
                <BodyS>Before</BodyS>
                <Divider {...args} />
                <BodyS>After</BodyS>
            </StyledWrapper>
        );
    },
};

export const DividerStories = [DividerDefault];
