import { ChangeEvent, useEffect, useState } from 'react';
import styled from 'styled-components';
import { general, PlasmaSaturation } from '@salutejs/plasma-colors';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { HoverSelect } from '../components/HoverSelect';
import { EditButton } from '../components/EditButton';
import { TextField } from '../components/TextField';
import { SaturationSelect } from '../components/SaturationSelect';
import { AccentSelect } from '../components/AccentSelect';
import { GeneralColor, GrayTone, grayTones, Parameters } from '../types';
import { useGlobalKeyDown } from '../hooks';
import { prettifyColorName } from '../utils';

export const Root = styled.div``;

const StyledSelectedParameters = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const StyledEditButton = styled(EditButton)`
    margin-top: 1.5rem;
`;

const StyledEditButton2 = styled(EditButton)`
    margin-top: 0.5rem;
`;

const StyledHoverSelect = styled(HoverSelect)`
    margin-top: 3rem;
`;

const StyledAccentSelect = styled(AccentSelect)`
    margin-top: 3rem;
`;

const StyledSaturationSelect = styled(SaturationSelect)`
    margin-top: 3rem;
`;

const StyledPreviewSaturation = styled.div<{ color: string }>`
    border-radius: 50%;
    width: 0.75rem;
    height: 0.75rem;
    background: ${({ color }) => color};
`;

const accentColors = Object.entries(general)
    .slice(0, -3)
    .map(([name, item]) => ({
        label: prettifyColorName(name),
        value: name,
        color: item[600],
    }));

interface SetupParametersProps {
    popupContentStep: number;
    parameters: Parameters;
    // TODO: убрать эни и сделать жденерик
    onChangeParameters: (name: string, value: any) => void;
    oChangePopupContentStep: (step: number) => void;
    onChangeGrayTone: (grayTone: string) => void;
    onChangeThemeMode: (themeMode: ThemeMode) => void;
    onPrevPage: () => void;
    onNextPage: (data: Parameters) => void;
}

export const SetupParameters = (props: SetupParametersProps) => {
    const {
        // projectName,
        // grayTone,
        popupContentStep,
        parameters,
        onChangeParameters,
        onChangeGrayTone,
        onChangeThemeMode,
        oChangePopupContentStep,
        onPrevPage,
        onNextPage,
    } = props;

    const [searchParams, setSearchParams] = useSearchParams();
    const editStep = searchParams.get('editStep') === null ? null : Number(searchParams.get('editStep'));

    console.log('editStep', editStep);

    // const [editStep, setEditStep] = useState<number | null>(null);

    useGlobalKeyDown((event) => {
        if (event.key === 'Escape') {
            onPrevPage();
        }
    });

    const saturations = Object.entries(general[parameters.accentColor])
        .reverse()
        .map(([saturation, value]) => ({
            value: saturation,
            color: value,
        }));

    const onChangeProjectName = (event: ChangeEvent<HTMLInputElement>) => {
        onChangeParameters('projectName', event.target.value);
    };

    const onChangePackagesName = (event: ChangeEvent<HTMLInputElement>) => {
        onChangeParameters('packagesName', event.target.value);
    };

    const onSelectGrayTone = (value: string) => {
        onChangeParameters('grayTone', value as GrayTone);

        if (editStep === null) {
            oChangePopupContentStep(1);
        }

        searchParams.delete('editStep');
        setSearchParams(searchParams);
        // setEditStep(null);
    };

    const onSelectAccentColor = (value: string) => {
        onChangeParameters('accentColor', value as GeneralColor);

        if (editStep === null) {
            onChangeThemeMode('light');
            oChangePopupContentStep(2);
        }

        searchParams.delete('editStep');
        setSearchParams(searchParams);
        // setEditStep(null);
    };

    const onSelectLightSaturation = (value: string) => {
        onChangeParameters('lightSaturation', Number(value) as PlasmaSaturation);
        onChangeThemeMode('dark');

        if (editStep === null) {
            oChangePopupContentStep(3);
        }

        searchParams.delete('editStep');
        setSearchParams(searchParams);
        // setEditStep(null);
    };

    const onSelectDarkSaturation = (value: string) => {
        onChangeParameters('darkSaturation', Number(value) as PlasmaSaturation);

        if (editStep === null) {
            oChangePopupContentStep(4);
        }

        searchParams.delete('editStep');
        setSearchParams(searchParams);

        // onNextPage(parameters);
    };

    useEffect(() => {
        if (popupContentStep === 4) {
            console.log('test');
            onNextPage(parameters);
        }
    }, [popupContentStep]);

    return (
        <Root>
            <StyledSelectedParameters>
                <TextField label="Имя проекта" value={parameters.projectName} onChange={onChangeProjectName} />
                <TextField label="Имя пакетов" value={parameters.packagesName} onChange={onChangePackagesName} />
            </StyledSelectedParameters>

            {popupContentStep >= 0 && (
                <>
                    {(popupContentStep <= 0 || editStep === 0) && (
                        <StyledHoverSelect
                            label="Оттенок серого для базовых токенов"
                            items={grayTones}
                            onHover={onChangeGrayTone}
                            onSelect={onSelectGrayTone}
                        />
                    )}
                    {popupContentStep >= 1 && editStep !== 0 && (
                        <StyledEditButton
                            label="Оттенок серого"
                            text={grayTones.find(({ value }) => value === parameters.grayTone)?.label || ''}
                            onClick={() => {
                                setSearchParams({ editStep: '0' });
                                // setEditStep(0);
                                onChangeThemeMode('dark');
                            }}
                        />
                    )}
                </>
            )}

            {popupContentStep >= 1 && (
                <>
                    {(popupContentStep <= 1 || editStep === 1) && (
                        <StyledAccentSelect
                            defaultValue="Green"
                            label="Цвет для акцентов"
                            items={accentColors}
                            onSelect={onSelectAccentColor}
                        />
                    )}
                    {popupContentStep >= 2 && editStep !== 1 && (
                        <StyledEditButton
                            label="Цвет для акцентов"
                            text={prettifyColorName(parameters.accentColor)}
                            onClick={() => {
                                setSearchParams({ editStep: '1' });
                                // setEditStep(1);
                                onChangeThemeMode('dark');
                            }}
                        />
                    )}
                </>
            )}

            {popupContentStep >= 2 && (
                <>
                    {(popupContentStep <= 2 || editStep === 2) && (
                        <StyledSaturationSelect
                            onSelect={onSelectLightSaturation}
                            label="Оттенок для светлой темы"
                            items={saturations}
                        />
                    )}
                    {popupContentStep >= 3 && editStep !== 2 && (
                        <StyledEditButton2
                            label="Оттенок для светлой темы"
                            contentLeft={
                                <StyledPreviewSaturation
                                    color={general[parameters.accentColor][parameters.lightSaturation]}
                                />
                            }
                            color={general[parameters.accentColor][parameters.lightSaturation]}
                            text={parameters.lightSaturation.toString()}
                            view="light"
                            onClick={() => {
                                setSearchParams({ editStep: '2' });
                                // setEditStep(2);
                                onChangeThemeMode('light');
                            }}
                        />
                    )}
                </>
            )}

            {popupContentStep >= 3 && (
                <>
                    {(popupContentStep <= 3 || editStep === 3) && (
                        <StyledSaturationSelect
                            onSelect={onSelectDarkSaturation}
                            label="Оттенок для тёмной"
                            items={saturations}
                        />
                    )}
                    {popupContentStep >= 4 && editStep !== 3 && (
                        <StyledEditButton2
                            label="Для тёмной"
                            contentLeft={
                                <StyledPreviewSaturation
                                    color={general[parameters.accentColor][parameters.darkSaturation]}
                                />
                            }
                            color={general[parameters.accentColor][parameters.darkSaturation]}
                            text={parameters.darkSaturation.toString()}
                            view="dark"
                            onClick={() => {
                                setSearchParams({ editStep: '3' });
                                // setEditStep(2);
                                onChangeThemeMode('dark');
                            }}
                        />
                    )}
                </>
            )}
        </Root>
    );
};
