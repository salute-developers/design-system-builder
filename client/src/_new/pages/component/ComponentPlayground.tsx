import { useMemo } from 'react';
import type { ThemeMode } from '@salutejs/plasma-tokens-utils';
import styled, { css } from 'styled-components';
import { Divider, Switch, TextXS } from '@salutejs/plasma-b2c';

import { ComponentControl } from './ComponentControl';
import type { Config, Variation } from '../../../componentBuilder';
import type { StaticAPI } from '../../../componentBuilder/type';

import { IconButtonStory, LinkStory, ButtonStory } from '../../stories';

const StyledRoot = styled.div`
    display: flex;
    gap: 1rem;
    flex: 1;
    flex-direction: column;
`;

const StyledComponentControls = styled.div`
    background: #0c0c0c;
    border: solid 1px #313131;

    height: 50%;
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
    border: solid 1px #313131;

    height: 50%;
    border-radius: 0.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
`;

const StyledComponentName = styled(TextXS)`
    position: absolute;
    top: 1rem;
    left: 1rem;
`;

const StyledSwitch = styled(Switch)`
    position: absolute;
    bottom: 1rem;
    right: 1rem;
`;

const StyledDivider = styled(Divider)`
    margin-top: 1rem;
`;

const StyledComponentWrapper = styled.div``;

const componentMapper: Record<string, (props: any) => JSX.Element> = {
    IconButton: IconButtonStory,
    Link: LinkStory,
    Button: ButtonStory,
};

interface ComponentPlaygroundProps {
    args: Record<string, string | boolean>;
    config: Config;
    vars: Record<string, string>;
    themeMode: ThemeMode;
    updateThemeMode: (value: ThemeMode) => void;
    onChange: (name: string, value: unknown) => void;
}

export const ComponentPlayground = (props: ComponentPlaygroundProps) => {
    const { args, vars, config, themeMode, updateThemeMode, onChange } = props;

    const componentName = config.getName();
    const variations = config.getVariations();
    const staticProps = config.getStaticAPI();

    const ComponentStory = useMemo(() => componentMapper[componentName], [componentName]);

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

    const renderStaticProps = (item: StaticAPI) => {
        const name = item.name;
        const list = item.items?.map((item) => ({
            label: item.label,
            value: item.value,
        }));

        return (
            <ComponentControl
                key={`static:${item.name}`}
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

    return (
        <StyledRoot>
            <StyledComponentPreview themeMode={themeMode}>
                <StyledComponentName color="var(--text-primary)">{componentName}</StyledComponentName>
                <StyledComponentWrapper style={{ ...vars }}>
                    <ComponentStory args={args} />
                </StyledComponentWrapper>
                <StyledSwitch checked={themeMode === 'dark'} onChange={onChangeThemeMode} />
            </StyledComponentPreview>
            <StyledComponentControls>
                {variations.map(renderDynamicProps)}
                <StyledDivider size="m" />
                {staticProps?.map(renderStaticProps)}
            </StyledComponentControls>
        </StyledRoot>
    );
};
