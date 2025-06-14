import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Button, DsplL, IconButton, Link, Select, TextField, TextS } from '@salutejs/plasma-b2c';

import { useMemo, useState } from 'react';
import { getGrayscale, loadAllDesignSystemNames, removeDesignSystem } from '../utils';
import type { ThemeData } from '../types';
import { FormField, getAccentColors, getSaturations } from '../components';
import { DesignSystem } from '../../designSystem';
import { PageWrapper } from './PageWrapper';
import { IconTrash } from '@salutejs/plasma-icons';

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledDesignSystemContent = styled.div`
    padding: 1rem;
    height: 100%;
    min-height: 0;

    display: flex;
    flex-direction: row;
    gap: 3rem;

    margin-bottom: 1rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
    border: solid 1px #313131;
`;

const StyledLoadedDesignSystems = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: scroll;
    width: 100%;
    padding: 0 1rem;
`;

const StyledLoadedDesignSystemItem = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
`;

const StyledButton = styled(Button)`
    background: var(--surface-transparent-primary);
    font-weight: 400;
`;

const StyledButtonContent = styled.div`
    align-items: center;
    justify-content: space-between;
    flex: 1;
    display: flex;
`;

const StyledLoadedDesignSystemName = styled.div``;

const StyledLoadedDesignSystemVersion = styled.div`
    opacity: 0.5;
`;

const StyledDesignSystemContent2 = styled.div`
    padding: 1rem;
    max-height: 14rem;
    min-height: 3rem;

    display: flex;
    flex-direction: row;
    gap: 3rem;

    margin-bottom: 1rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
    border: solid 1px #313131;
`;

const StyledDesignSystemItem = styled.div`
    flex: 1;
`;

const StyledServiceName = styled(DsplL)`
    margin-top: -2rem;

    line-height: 10rem;
    letter-spacing: 1rem;
`;

interface MainProps {
    designSystem: DesignSystem;
    setDesignSystem: (value: DesignSystem) => void;
}

export const Main = (props: MainProps) => {
    const navigate = useNavigate();

    const [loadedDesignSystems, setLoadedDesignSystems] = useState(loadAllDesignSystemNames());

    const { designSystem, setDesignSystem } = props;

    const [data, setData] = useState<any>({
        themeName: '',
        themeVersion: '0.1.0',
        accentColors: getAccentColors()[11].value,
        lightSaturations: getSaturations()[7].value,
        darkSaturations: getSaturations()[7].value,
        lightGrayscale: getGrayscale()[0].value,
        darkGrayscale: getGrayscale()[0].value,
    });

    const onChangeData = (name: string) => (param: React.ChangeEvent<HTMLInputElement> | unknown) => {
        const value = (param as React.ChangeEvent<HTMLInputElement>).target?.value ?? param;

        setData((prevState: any) => ({
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

    const onLoadDesignSystem = (name: string, version: string) => {
        setDesignSystem(new DesignSystem({ name, version }));
        navigate(`/${name}/${version}/theme`);
    };

    const onRemoveDesignSystem = async (name: string, version: string) => {
        removeDesignSystem(name, version);
        setLoadedDesignSystems(loadAllDesignSystemNames());
    };

    const onDesignSystemSave = async () => {
        // TODO: выбранные значения цветов пока будут временно игнорироваться
        // const { themeName, accentColors, lightSaturations, darkSaturations, lightGrayscale, darkGrayscale } = data;
        // const userConfig = {
        //     name: themeName,
        //     accentColor: {
        //         dark: `[general.${accentColors}.${darkSaturations}]`,
        //         light: `[general.${accentColors}.${lightSaturations}]`,
        //     },
        //     grayscale: {
        //         dark: lightGrayscale,
        //         light: darkGrayscale,
        //     },
        // };

        setDesignSystem(new DesignSystem({ name: data.themeName, version: data.themeVersion }));

        navigate(`/${data.themeName}/${designSystem.getVersion()}/theme`);
    };

    return (
        <PageWrapper>
            {loadedDesignSystems && (
                <StyledDesignSystemContent2>
                    <TextS>Продолжить редактировать дизайн систему</TextS>
                    <StyledLoadedDesignSystems>
                        {loadedDesignSystems.map(([name, version]) => (
                            <StyledLoadedDesignSystemItem key={`${name}@${version}`}>
                                <StyledButton
                                    stretching="filled"
                                    view="secondary"
                                    size="m"
                                    onClick={() => onLoadDesignSystem(name, version)}
                                >
                                    <StyledButtonContent>
                                        <StyledLoadedDesignSystemName>{name}</StyledLoadedDesignSystemName>
                                        <StyledLoadedDesignSystemVersion>{version}</StyledLoadedDesignSystemVersion>
                                    </StyledButtonContent>
                                </StyledButton>
                                <IconButton size="m" view="clear" onClick={() => onRemoveDesignSystem(name, version)}>
                                    <IconTrash size="s" />
                                </IconButton>
                            </StyledLoadedDesignSystemItem>
                        ))}
                    </StyledLoadedDesignSystems>
                </StyledDesignSystemContent2>
            )}
            <StyledDesignSystemContent>
                <StyledDesignSystemItem>
                    <StyledServiceName>DESIGN SYSTEM BUILDER</StyledServiceName>
                    <Link href="https://plasma.sberdevices.ru/" target="_blank">
                        by plasma team
                    </Link>
                </StyledDesignSystemItem>
                <StyledDesignSystemItem style={{ overflowY: 'scroll' }}>
                    <FormField label="Название дизайн системы">
                        <TextField size="m" value={data.themeName} onChange={onChangeData('themeName')} />
                    </FormField>
                    <FormField label="Версия дизайн системы">
                        <TextField size="m" value={data.themeVersion} onChange={onChangeData('themeVersion')} />
                    </FormField>
                    <FormField label="Акцентный цвет из основной палитры">
                        <Select
                            disabled
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
                            disabled
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
                            disabled
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
                            disabled
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
                            disabled
                            size="m"
                            listMaxHeight="25"
                            listOverflow="scroll"
                            value={data.darkGrayscale}
                            items={grayscale}
                            onChange={onChangeData('darkGrayscale')}
                        />
                    </FormField>
                </StyledDesignSystemItem>
            </StyledDesignSystemContent>
            <StyledActions>
                <Button view="accent" onClick={onGoDemo} text="Демо" />
                <Button view="primary" onClick={onDesignSystemSave} text="Начать" />
            </StyledActions>
        </PageWrapper>
    );
};
