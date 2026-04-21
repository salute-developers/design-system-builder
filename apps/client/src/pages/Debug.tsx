import { ChangeEvent, useCallback, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
    IconSave,
    IconDownload,
    IconCloudUploadOutline,
    IconDocumentImportOutline,
    IconUploadOutline,
    IconFileTextOutline,
    IconTrashOutline,
} from '@salutejs/plasma-icons';

import { BasicButton, LinkButton, Modal, Switch, TextField } from '../components';
import { Config, DesignSystem, Theme, type ThemeSource } from '../controllers';
import { importTokensToTheme, importDesignSystem, btoaUtf8, clearDraft } from '../utils';
import { Parameters } from '../types';
import { DB_SERVICE_URL } from '../api';
import { designSystemSave, generateAndDeployDocumentation, generatePublish } from './Main.utils';

const spin = keyframes`
    to { 
        transform: rotate(360deg); 
    }
`;

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

    isolation: isolate;
`;

const Overlay = styled.div`
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
`;

const Spinner = styled.div`
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: ${spin} 0.6s linear infinite;
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
    reload: () => void;
}

// TODO: Временный компонент, выводить только в дев окружении, завязаться на ENV
export const Debug = (props: DebugProps) => {
    const { designSystem, theme, components, rerender, reload } = props;

    const [importDialogData, setImportDialogData] = useState<ImportDialogData | null>(null);
    const [isDefaultName, setIsDefaultName] = useState(true);
    const [customName, setCustomName] = useState('');
    const [loading, setLoading] = useState(false);
    const [isClearDraftDialogOpen, setIsClearDraftDialogOpen] = useState(false);

    const withLoading = useCallback(
        <T,>(fn: () => Promise<T>) =>
            async () => {
                setLoading(true);
                try {
                    await fn();
                } finally {
                    setLoading(false);
                }
            },
        [],
    );

    // const onDebugDesignSystemDownload = async () => {
    //     if (!designSystem) {
    //         return;
    //     }

    //     return await generateDownload(designSystem, 'tgz');
    // };

    const onDesignSystemDownload = async () => {
        if (!designSystem) {
            return;
        }

        const name = designSystem.getName();
        const token = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

        const response = await fetch(`${DB_SERVICE_URL}/legacy/design-systems/${name}/download-theme`, {
            headers: {
                Authorization: `Basic ${token}`,
            },
        });

        if (!response.ok) {
            console.error('Failed to download theme:', response.statusText);
            return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? `${name}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const onDesignSystemPublish = async () => {
        if (!designSystem) {
            return;
        }

        return await generatePublish(designSystem, 'tgz', import.meta.env.VITE_NPM_REGISTRY);
    };

    const onDesignSystemDocs = async () => {
        if (!designSystem) {
            return;
        }

        return await generateAndDeployDocumentation(designSystem);
    };

    const onClearDraftClick = () => {
        setIsClearDraftDialogOpen(true);
    };

    const onClearDraftConfirm = async () => {
        setIsClearDraftDialogOpen(false);

        if (!designSystem) {
            return;
        }

        clearDraft(designSystem.getName(), designSystem.getVersion());
        reload();
    };

    const onClearDraftCancel = () => {
        setIsClearDraftDialogOpen(false);
    };

    const onDesignSystemSave = async () => {
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

        setLoading(true);

        try {
            const content = await file.text();
            const parsed = JSON.parse(content);

            if (parsed.name !== designSystem?.getName()) {
                throw new Error('Имя дизайн системы в файле не совпадает с текущей дизайн системой');
            }

            importTokensToTheme(parsed, theme);
            rerender();

            console.log('Tokens imported successfully');
        } catch (error) {
            console.error('Failed to import tokens:', error);
        } finally {
            setLoading(false);
        }
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

        setLoading(true);

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
        } finally {
            setLoading(false);
        }

        setImportDialogData(null);
    };

    const onImportCancel = () => {
        setImportDialogData(null);
    };

    return (
        <>
            <Root>
                {loading && (
                    <Overlay>
                        <Spinner />
                    </Overlay>
                )}
                <LinkButton
                    text="Сохранить тему и компоненты"
                    contentRight={<IconSave size="s" />}
                    onClick={withLoading(onDesignSystemSave)}
                />
                <LinkButton
                    text="Очистить черновик дизайн системы"
                    contentRight={<IconTrashOutline size="s" />}
                    onClick={onClearDraftClick}
                />
                {/* <LinkButton
                    text="Скачать дизайн систему"
                    contentRight={<IconDownload size="s" />}
                    onClick={onDebugDesignSystemDownload}
                /> */}
                <LinkButton
                    text="Опубликовать"
                    contentRight={<IconCloudUploadOutline size="s" />}
                    onClick={withLoading(onDesignSystemPublish)}
                />
                <LinkButton
                    text="Опубликовать документацию"
                    contentRight={<IconFileTextOutline size="s" />}
                    onClick={withLoading(onDesignSystemDocs)}
                />
                <LinkButton
                    text="Импортировать токены (PIXSO)"
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
                <LinkButton
                    text="Скачать дизайн систему"
                    contentRight={<IconDownload size="s" />}
                    onClick={withLoading(onDesignSystemDownload)}
                />
            </Root>
            {isClearDraftDialogOpen && (
                <Modal
                    title="Очистить черновик"
                    onClickOutside={onClearDraftCancel}
                    actions={[
                        <BasicButton text="Отмена" backgroundColor="transparent" onClick={onClearDraftCancel} />,
                        <BasicButton text="Очистить" onClick={onClearDraftConfirm} />,
                    ]}
                >
                    Все несохранённые изменения будут потеряны. Продолжить?
                </Modal>
            )}
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
