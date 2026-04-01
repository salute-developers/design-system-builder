import { ChangeEvent, useState } from 'react';
import styled from 'styled-components';
import {
    IconSave,
    IconDownload,
    IconCloudUploadOutline,
    IconDocumentImportOutline,
    IconUploadOutline,
    IconFileTextOutline,
} from '@salutejs/plasma-icons';

import { BasicButton, LinkButton, Modal, Switch, TextField } from '../components';
import { Config, DesignSystem, Theme, type ThemeSource } from '../controllers';
import { importTokensToTheme, importDesignSystem } from '../utils';
import { Parameters } from '../types';
import { designSystemSave, generateAndDeployDocumentation, generateDownload, generatePublish } from './Main.utils';

const Root = styled.div`
    z-index: 99999;
    background: black;
    padding: 0.25rem;
    border-radius: 0.5rem;
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-end;
`;

interface ImportDialogData {
    defaultName: string;
    parameters: Partial<Parameters>;
    themeData: ThemeSource;
}

interface DebugProps {
    designSystem: DesignSystem | null;
    theme: Theme | null;
    components: Config[] | null;
    rerender: () => void;
}

// TODO: Временный компонент, выводить только в дев окружении, завязаться на ENV
export const Debug = (props: DebugProps) => {
    const { designSystem, theme, components, rerender } = props;

    const [importDialogData, setImportDialogData] = useState<ImportDialogData | null>(null);
    const [isDefaultName, setIsDefaultName] = useState(true);
    const [customName, setCustomName] = useState('');

    const onDebugDesignSystemDownload = async () => {
        if (!designSystem) {
            return;
        }

        return await generateDownload(designSystem, 'tgz');
    };

    const onDebugDesignSystemPublish = async () => {
        if (!designSystem) {
            return;
        }

        return await generatePublish(designSystem, 'tgz', import.meta.env.VITE_NPM_REGISTRY);
    };

    const onDebugDesignSystemDocs = async () => {
        if (!designSystem) {
            return;
        }

        return await generateAndDeployDocumentation(designSystem);
    };

    const onDebugDesignSystemSave = async () => {
        if (!designSystem || !theme || !components) {
            return;
        }

        return await designSystemSave(designSystem, theme, components);
    };

    const onUploadTokens = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file || !theme) {
            return;
        }

        const reader = new FileReader();

        reader.onload = async (event: ProgressEvent<FileReader>) => {
            const content = event.target?.result;

            if (typeof content !== 'string') {
                return;
            }

            try {
                const parsed = JSON.parse(content);

                if (parsed.name !== designSystem?.getName()) {
                    throw new Error('Имя дизайн системы в файле не совпадает с текущей дизайн системой');
                }

                importTokensToTheme(parsed, theme);
                rerender();

                console.log('Tokens imported successfully');
            } catch (error) {
                console.error('Failed to import tokens:', error);
            }
        };

        reader.readAsText(file);
    };

    const onUploadDesignSystem = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        try {
            const content = file.name.endsWith('.json') ? await file.text() : await file.arrayBuffer();

            const { name, parameters, themeData } = await importDesignSystem(content);

            setImportDialogData({ defaultName: name, parameters, themeData });
            setCustomName(name);
            setIsDefaultName(true);
        } catch (error) {
            console.error('Failed to import design system:', error);
        }
    };

    const onImportConfirm = async () => {
        if (!importDialogData) {
            return;
        }

        const { defaultName, parameters, themeData } = importDialogData;
        const name = isDefaultName ? defaultName : customName;

        try {
            await DesignSystem.create({
                name,
                version: '0.1.0',
                parameters: { ...parameters, projectName: name.split('_').join(' ').toUpperCase(), packagesName: name },
                themeData,
            });

            console.log('Design system imported successfully');
        } catch (error) {
            console.error('Failed to import design system:', error);
        }

        setImportDialogData(null);
    };

    const onImportCancel = () => {
        setImportDialogData(null);
    };

    return (
        <>
            <Root>
                <LinkButton
                    text="Сохранить тему и компоненты"
                    contentRight={<IconSave size="s" />}
                    onClick={onDebugDesignSystemSave}
                />
                <LinkButton
                    text="Скачать дизайн систему"
                    contentRight={<IconDownload size="s" />}
                    onClick={onDebugDesignSystemDownload}
                />
                <LinkButton
                    text="Опубликовать"
                    contentRight={<IconCloudUploadOutline size="s" />}
                    onClick={onDebugDesignSystemPublish}
                />
                <LinkButton
                    text="Опубликовать документацию"
                    contentRight={<IconFileTextOutline size="s" />}
                    onClick={onDebugDesignSystemDocs}
                />
                <LinkButton
                    text="Импортировать токены"
                    contentRight={<IconDocumentImportOutline size="s" />}
                    accept=".json"
                    onFileChange={onUploadTokens}
                />
                <LinkButton
                    text="Импортировать дизайн систему"
                    contentRight={<IconUploadOutline size="s" />}
                    accept=".zip, .json"
                    onFileChange={onUploadDesignSystem}
                />
            </Root>
            {importDialogData && (
                <Modal
                    title="Импортировать дизайн систему"
                    onClickOutside={onImportCancel}
                    actions={[
                        <BasicButton text="Отмена" backgroundColor="transparent" onClick={onImportCancel} />,
                        <BasicButton text="Импортировать" onClick={onImportConfirm} />,
                    ]}
                >
                    <Switch
                        checked={isDefaultName}
                        label="Оставить название по умолчанию"
                        onToggle={(checked) => {
                            setIsDefaultName(checked);
                            if (checked) {
                                setCustomName(importDialogData.defaultName);
                            }
                        }}
                    />
                    <TextField
                        value={isDefaultName ? importDialogData.defaultName : customName}
                        readOnly={isDefaultName}
                        label="Название дизайн системы"
                        stretched
                        hasBackground
                        onChange={(value) => setCustomName(value)}
                    />
                </Modal>
            )}
        </>
    );
};
