import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Button, DsplL, Link, Select, TextField } from '@salutejs/plasma-b2c';

import { buildDefaultTheme, type Theme } from '../../themeBuilder';
import { useMemo, useState } from 'react';
import { getGrayscale } from '../utils';
import type { ThemeData } from '../types';
import { FormField, getAccentColors, getSaturations } from '../components';

const NoScroll = createGlobalStyle`
    html, body {
        overscroll-behavior: none;
    }
`;

const StyledContainer = styled.div`
    position: relative;

    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    background-color: #000;
`;

const StyledWrapper = styled.div`
    position: relative;
    inset: 3rem;
    top: 4.5rem;
    border-radius: 0.5rem;
    height: calc(100vh - 7rem);
    width: calc(100% - 6rem);

    overflow: hidden;

    display: flex;
    flex-direction: column;

    ::-webkit-scrollbar {
        display: none;
    }
    scrollbar-width: none;
`;

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledThemeContent = styled.div`
    padding: 1rem;
    height: 100%;

    display: flex;
    flex-direction: row;
    gap: 3rem;

    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
`;

const StyledThemeContentItem = styled.div`
    flex: 1;
`;

const StyledServiceName = styled(DsplL)`
    margin-top: -2rem;

    line-height: 10rem;
    letter-spacing: 1rem;
`;

interface MainProps {
    createTheme: (value: Theme) => void;
}

export const Main = (props: MainProps) => {
    const { createTheme } = props;

    const navigate = useNavigate();

    const [data, setData] = useState<ThemeData>({
        themeName: '',
        accentColors: getAccentColors()[11].value,
        lightSaturations: getSaturations()[7].value,
        darkSaturations: getSaturations()[7].value,
        lightGrayscale: getGrayscale()[0].value,
        darkGrayscale: getGrayscale()[0].value,
    });

    const onChangeData = (name: string) => (param: React.ChangeEvent<HTMLInputElement> | unknown) => {
        const value = (param as React.ChangeEvent<HTMLInputElement>).target?.value ?? param;

        setData((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    };

    const accentColors = useMemo(() => getAccentColors(), []);

    const saturations = useMemo(() => getSaturations(data.accentColors), [data.accentColors]);

    const grayscale = useMemo(() => getGrayscale(), []);

    const onGoDemo = () => {
        navigate('/demo');
    };

    const onThemeSave = () => {
        const { themeName, accentColors, lightSaturations, darkSaturations, lightGrayscale, darkGrayscale } = data;

        const userConfig = {
            name: themeName,
            accentColor: {
                dark: `[general.${accentColors}.${darkSaturations}]`,
                light: `[general.${accentColors}.${lightSaturations}]`,
            },
            grayscale: {
                dark: lightGrayscale,
                light: darkGrayscale,
            },
        };

        createTheme(buildDefaultTheme(userConfig));
        navigate('/theme');
    };

    return (
        <StyledContainer>
            <StyledWrapper>
                <StyledThemeContent>
                    <StyledThemeContentItem>
                        <StyledServiceName>DESIGN SYSTEM BUILDER</StyledServiceName>
                        <Link href="https://plasma.sberdevices.ru/" target="_blank">
                            by plasma team
                        </Link>
                    </StyledThemeContentItem>
                    <StyledThemeContentItem>
                        <FormField label="Название дизайн системы">
                            <TextField size="m" value={data.themeName} onChange={onChangeData('themeName')} />
                        </FormField>
                        <FormField label="Акцентный цвет из основной палитры">
                            <Select
                                size="m"
                                listMaxHeight="25"
                                listOverflow="scroll"
                                value={data.accentColors}
                                items={accentColors}
                                onChange={onChangeData('accentColors')}
                            />
                        </FormField>
                        <FormField label="Светлость акцентного цвета для светлой темы">
                            <Select
                                size="m"
                                listMaxHeight="25"
                                listOverflow="scroll"
                                value={data.lightSaturations}
                                items={saturations}
                                onChange={onChangeData('lightSaturations')}
                            />
                        </FormField>
                        <FormField label="Светлость акцентного цвета для темной темы">
                            <Select
                                size="m"
                                listMaxHeight="25"
                                listOverflow="scroll"
                                value={data.darkSaturations}
                                items={saturations}
                                onChange={onChangeData('darkSaturations')}
                            />
                        </FormField>
                        <FormField label="Оттенок серого для светлой темы">
                            <Select
                                size="m"
                                listMaxHeight="25"
                                listOverflow="scroll"
                                value={data.lightGrayscale}
                                items={grayscale}
                                onChange={onChangeData('lightGrayscale')}
                            />
                        </FormField>
                        <FormField label="Оттенок серого для темной темы">
                            <Select
                                size="m"
                                listMaxHeight="25"
                                listOverflow="scroll"
                                value={data.darkGrayscale}
                                items={grayscale}
                                onChange={onChangeData('darkGrayscale')}
                            />
                        </FormField>
                    </StyledThemeContentItem>
                </StyledThemeContent>
                <StyledActions>
                    <Button view="accent" onClick={onGoDemo} text="Демо" />
                    <Button view="primary" onClick={onThemeSave} text="Подтвердить" />
                </StyledActions>
            </StyledWrapper>
            <NoScroll />
        </StyledContainer>
    );
};
