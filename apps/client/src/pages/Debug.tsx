import { ChangeEvent } from 'react';
import styled from 'styled-components';
import { IconSave } from '@salutejs/plasma-icons';

import { LinkButton } from '../components';
import { Config, DesignSystem, Theme } from '../controllers';
import { designSystemSave, generateAndDeployDocumentation, generateDownload, generatePublish } from './Main.utils';
import { importTokensToTheme } from '../utils';
import { importDesignSystem } from '../utils/importDesignSystem';

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

interface DebugProps {
    designSystem: DesignSystem | null;
    theme: Theme | null;
    components: Config[] | null;
    rerender: () => void;
}

// TODO: Временный компонент, выводить только в дев окружении, завязаться на ENV
export const Debug = (props: DebugProps) => {
    const { designSystem, theme, components, rerender } = props;

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

            await DesignSystem.create({
                name,
                version: '0.1.0',
                parameters,
                themeData,
            });

            console.log('Design system imported successfully');
        } catch (error) {
            console.error('Failed to import design system:', error);
        }
    };

    return (
        <Root>
            <LinkButton
                text="Сохранить тему и компоненты"
                contentRight={<IconSave size="s" />}
                onClick={onDebugDesignSystemSave}
            />
            <LinkButton
                text="Скачать дизайн систему"
                contentRight={<IconSave size="s" />}
                onClick={onDebugDesignSystemDownload}
            />
            <LinkButton text="Опубликовать" contentRight={<IconSave size="s" />} onClick={onDebugDesignSystemPublish} />
            <LinkButton
                text="Опубликовать документацию"
                contentRight={<IconSave size="s" />}
                onClick={onDebugDesignSystemDocs}
            />
            <LinkButton
                text="Импортировать токены"
                contentRight={<IconSave size="s" />}
                accept=".json"
                onFileChange={onUploadTokens}
            />
            <LinkButton
                text="Импортировать дизайн систему"
                contentRight={<IconSave size="s" />}
                accept=".zip, .json"
                onFileChange={onUploadDesignSystem}
            />
        </Root>
    );
};
