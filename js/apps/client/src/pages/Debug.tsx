import { ChangeEvent, MouseEvent, useCallback, useState } from 'react';
import { isAxiosError } from 'axios';
import styled, { keyframes } from 'styled-components';
import { IconSave, IconDocumentImportOutline, IconTrashOutline } from '@salutejs/plasma-icons';

import { BasicButton, LinkButton, Dialog } from '../components';
import { Config, DesignSystem, Theme } from '../controllers';
import { importTokensToTheme, clearDraft } from '../utils';
import { designSystemSave } from './Main.utils';

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

    const [loading, setLoading] = useState(false);
    const [isClearDraftDialogOpen, setIsClearDraftDialogOpen] = useState(false);

    const withDesignSystem = <T,>(action: (loadedDesignSystem: DesignSystem) => T) =>
        designSystem ? action(designSystem) : undefined;

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

    const onClearDraftClick = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setIsClearDraftDialogOpen(true);
    };

    const onClearDraftConfirm = async () => {
        setIsClearDraftDialogOpen(false);

        withDesignSystem((loadedDesignSystem) => {
            clearDraft(loadedDesignSystem.getName(), loadedDesignSystem.getVersion());
            reload();
        });
    };

    const onClearDraftCancel = () => {
        setIsClearDraftDialogOpen(false);
    };

    const onDesignSystemSave = async () => {
        if (!designSystem || !theme || !components) {
            return;
        }

        try {
            const result = await designSystemSave(designSystem, theme, components);
            clearDraft(designSystem.getName(), designSystem.getVersion());
            return result;
        } catch (error) {
            if (
                isAxiosError(error) &&
                error.response?.status === 409 &&
                error.response.data?.code === 'TENANT_EDIT_CONFLICT'
            ) {
                if (
                    window.confirm(
                        'Тема уже изменена в другой сессии. Черновик сохранён. Перезагрузить актуальные данные?',
                    )
                ) {
                    reload();
                }
                return;
            }
            throw error;
        }
    };

    const onImportTokens = async (event: ChangeEvent<HTMLInputElement>) => {
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
                <LinkButton
                    text="Импортировать токены (PIXSO)"
                    contentRight={<IconDocumentImportOutline size="s" />}
                    accept=".json"
                    onFileChange={onImportTokens}
                />
            </Root>
            <Dialog
                opened={isClearDraftDialogOpen}
                title="Очистить черновик"
                onClose={onClearDraftCancel}
                actions={[
                    <BasicButton text="Отмена" onClick={onClearDraftCancel} />,
                    <BasicButton text="Очистить" backgroundColor="#D13535" onClick={onClearDraftConfirm} />,
                ]}
            >
                Все несохранённые изменения будут потеряны. Продолжить?
            </Dialog>
        </>
    );
};
