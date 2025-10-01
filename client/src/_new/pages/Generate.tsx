import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { BodyM, Button, Select } from '@salutejs/plasma-b2c';

import { DesignSystem } from '../../designSystem';
import { PageWrapper } from './PageWrapper';

const HOST = 'http://localhost:3000'

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

    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);

    useEffect(() => {
        const initializeDesignSystem = async () => {
            if (designSystemName && designSystemVersion) {
                const ds = await DesignSystem.get({ name: designSystemName, version: designSystemVersion });
                setDesignSystem(ds);
            }
        };
        initializeDesignSystem();
    }, [designSystemName, designSystemVersion]);

    const [isLoading, setIsLoading] = useState(false);
    const [exportType, setExportType] = useState('tgz');

    if (!designSystem) {
        return <div>Loading...</div>;
    }

    const currentLocation = `${ designSystem.getName() }/${ designSystem.getVersion() }`;

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
        navigate(`/${ currentLocation }/components`);
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

        const result = await fetch(`${HOST}/generate`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!result) {
            setIsLoading(false)
        }

        const reader = result.body?.getReader();

        const chunks = [];

        let archiveDetected = false;

        while (true) {
            const { value, done } = await reader!.read();
            if (done) break;

            const u8 = new Uint8Array(value);

            if (!archiveDetected) {
                for (let i = 0; i < u8.length - 3; i++) {
                    // TGZ
                    if (u8[i] === 0x1f && u8[i + 1] === 0x8b) {
                        archiveDetected = true;
                        const sliced = u8.slice(i);
                        chunks.push(sliced);
                        break;
                    }

                    // ZIP
                    if (
                        u8[i] === 0x50 && u8[i + 1] === 0x4b &&
                        u8[i + 2] === 0x03 && u8[i + 3] === 0x04
                    ) {
                        archiveDetected = true;
                        const sliced = u8.slice(i);
                        chunks.push(sliced);
                        break;
                    }
                }

                if (!archiveDetected) continue;
            } else {
                chunks.push(value);
            }
        }

        const blob = new Blob(chunks);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ designSystem.getName() }@${ designSystem.getVersion() }.${ exportType }`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setIsLoading(false);
    };

    return (
        <PageWrapper designSystem={ designSystem }>
            <StyledGenerateContent>
                <StyledExportType>
                    <BodyM>Тип экспорта</BodyM>
                    <Select
                        size="m"
                        listMaxHeight="25"
                        listOverflow="scroll"
                        value={ exportType }
                        items={ exportTypes }
                        onChange={ onChangeExportType }
                    />
                </StyledExportType>
            </StyledGenerateContent>
            <StyledActions>
                <Button view="clear" onClick={ onGoComponents } text="Назад"/>
                <Button
                    view="primary"
                    onClick={ onDesignSystemGenerate }
                    disabled={ isLoading }
                    isLoading={ isLoading }
                    text="Создать дизайн систему"
                />
            </StyledActions>
        </PageWrapper>
    );
};
