import { IconSave } from '@salutejs/plasma-icons';
import styled from 'styled-components';

import { LinkButton } from '../components';
import { Config, DesignSystem, Theme } from '../controllers';
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

interface DebugProps {
    designSystem: DesignSystem | null;
    theme: Theme | null;
    components: Config[] | null;
}

// TODO: Временный компонент, выводить только в дев окружении, завязаться на ENV
export const Debug = (props: DebugProps) => {
    const { designSystem, theme, components } = props;

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
        </Root>
    );
};
