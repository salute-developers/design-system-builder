import { useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { BodyM, Button, Select } from '@salutejs/plasma-b2c';

import { DesignSystem } from '../../designSystem';
import { PageWrapper } from './PageWrapper';

const StyledGenerateContent = styled.div`
    padding: 1rem;
    height: 100%;

    display: flex;
    flex-direction: column;

    gap: 3rem;

    margin-bottom: 1rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
    border: solid 1px #313131;
`;

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledExportType = styled.div`
    height: 4rem;
    gap: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GenerateProps {
    // designSystem: DesignSystem;
}

export const Generate = (props: GenerateProps) => {
    const navigate = useNavigate();
    const { designSystemName, designSystemVersion } = useParams();

    const designSystem = new DesignSystem({ name: designSystemName, version: designSystemVersion });

    const currentLocation = `${designSystem.getName()}/${designSystem.getVersion()}`;

    const [isLoading, setIsLoading] = useState(false);
    const [exportType, setExportType] = useState('tgz');

    const exportTypes = [
        {
            value: 'tgz',
            label: 'tgz',
        },
        {
            value: 'zip',
            label: 'zip',
        },
    ];

    const onChangeExportType = (value: string) => {
        setExportType(value);
    };

    const onGoComponents = () => {
        navigate(`/${currentLocation}/components`);
    };

    const onDesignSystemGenerate = async () => {
        const themeSource = designSystem.getThemeData('web');
        const componentsMeta = designSystem.getComponentsData();

        const data = {
            packageName: designSystem.getName(),
            packageVersion: designSystem.getVersion(),
            componentsMeta,
            themeSource,
            exportType,
        };

        console.log('data', data);

        setIsLoading(true);

        const result = await fetch('https://pr-2-ds-generator.dev.app.sberdevices.ru/generate', {
        // const result = await fetch('http://localhost:3000/generate', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const blob = await result.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${designSystem.getName()}@${designSystem.getVersion()}.${exportType}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setIsLoading(false);

        console.log('test', result);
    };

    return (
        <PageWrapper designSystem={designSystem}>
            <StyledGenerateContent>
                <StyledExportType>
                    <BodyM>Тип экспорта</BodyM>
                    <Select
                        size="m"
                        listMaxHeight="25"
                        listOverflow="scroll"
                        value={exportType}
                        items={exportTypes}
                        onChange={onChangeExportType}
                    />
                </StyledExportType>
            </StyledGenerateContent>
            <StyledActions>
                <Button view="clear" onClick={onGoComponents} text="Назад" />
                <Button
                    view="primary"
                    onClick={onDesignSystemGenerate}
                    disabled={isLoading}
                    isLoading={isLoading}
                    text="Создать дизайн систему"
                />
            </StyledActions>
        </PageWrapper>
    );
};
