import styled, { css } from 'styled-components';
import type { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { Divider, Switch, TextXS } from '@salutejs/plasma-b2c';
import { backgroundSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { ComponentControl } from './ComponentControl';
import type { Config, Variation } from '../controllers';

import { useStory } from '../hooks';

const StyledRoot = styled.div`
    display: flex;
    gap: 1rem;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
`;

const StyledComponentControls = styled.div`
    background: ${backgroundSecondary};
    // border: solid 1px #313131;

    flex: 1;
    padding: 1rem;
    padding-top: 0;
    border-radius: 0.5rem;
    overflow-x: hidden;
    overflow-y: scroll;
`;

// TODO: переделать стилизацию когда добавлю ViewContainer
const StyledComponentPreview = styled.div<{ themeMode: ThemeMode }>`
    position: relative;

    ${({ themeMode }) =>
        themeMode === 'dark'
            ? css`
                  --background-primary: #0c0c0c;
                  --text-primary: #fffffff5;
                  --surface-transparent-tertiary: #3f81fd;
                  --surface-transparent-tertiary-hover: #3f81fd;
              `
            : css`
                  --background-primary: #f3f3f3;
                  --text-primary: #0c0c0c;
                  --surface-transparent-tertiary: #3f81fd;
                  --surface-transparent-tertiary-hover: #3f81fd;
              `}

    transition: background 0.2s ease-in-out;

    background: var(--background-primary);
    // border: solid 1px #313131;

    border-radius: 0.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 2;
    min-height: 0;
`;

const StyledComponentName = styled(TextXS)`
    position: absolute;
    top: 1rem;
    left: 1rem;
`;

const StyledStoriesSelector = styled.div`
    position: absolute;
    left: 1rem;
    bottom: 1rem;
    width: 30rem;
`;

const StyledSwitch = styled(Switch)`
    position: absolute;
    bottom: 1rem;
    right: 1rem;
`;

const StyledDivider = styled(Divider)`
    margin-top: 1rem;
`;

const StyledComponentWrapper = styled.div`
    overflow-x: hidden;
    overflow-y: scroll;
    height: 100%;
    padding: 0 1rem;
    display: flex;
    align-items: center;
`;

interface ComponentPlaygroundProps {
    args: Record<string, string | boolean>;
    config: Config;
    vars: Record<string, string>;
    themeMode: ThemeMode;
    updateThemeMode: (value: ThemeMode) => void;
    onUpdateComponentProps: (values: Record<string, any>) => void;
    onChange: (name: string, value: unknown) => void;
}

export const ComponentPlayground = (props: ComponentPlaygroundProps) => {
    const { args, vars, config, themeMode, updateThemeMode, onChange, onUpdateComponentProps } = props;

    const componentName = config.getName();
    const variations = config.getVariations();

    const renderDynamicProps = (item: Variation) => {
        const name = item.getName();
        const list = item.getStyles()?.map((style) => ({
            label: style.getName(),
            value: style.getID(),
        }));

        return (
            <ComponentControl
                key={`dynamic:${item.getName()}`}
                name={name}
                items={list}
                value={args[name]}
                onChangeValue={onChange}
            />
        );
    };

    const renderStoryProps = (item: Record<string, any>) => {
        const name = item.name;
        const list = item.items?.map((item: { label: string; value: string }) => ({
            label: item.label,
            value: item.value,
        }));

        return (
            <ComponentControl
                key={`story:${item.name}`}
                name={name}
                items={list}
                value={args[name]}
                onChangeValue={onChange}
            />
        );
    };

    const onChangeThemeMode = () => {
        updateThemeMode(themeMode === 'dark' ? 'light' : 'dark');
    };

    const [selectedStory, setSelectedStory, storyArgs, items, Story] = useStory(componentName, onUpdateComponentProps);

    return (
        <StyledRoot>
            <StyledComponentPreview themeMode={themeMode}>
                <StyledComponentName color="var(--text-primary)">{componentName}</StyledComponentName>
                <StyledComponentWrapper style={{ ...vars }}>
                    <Story {...args} />
                </StyledComponentWrapper>
                <StyledStoriesSelector>
                    {/* <SegmentProvider defaultSelected={[selectedStory.value]} singleSelectedRequired> */}
                    {/* <Segment items={items} setActiveItem={setSelectedStory} /> */}
                    {/* </SegmentProvider> */}
                </StyledStoriesSelector>
                <StyledSwitch checked={themeMode === 'dark'} onChange={onChangeThemeMode} />
            </StyledComponentPreview>
            <StyledComponentControls>
                {variations.map(renderDynamicProps)}
                <StyledDivider size="m" />
                {storyArgs.map(renderStoryProps)}
            </StyledComponentControls>
        </StyledRoot>
    );
};
