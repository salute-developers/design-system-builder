import styled from 'styled-components';
import { IconButton, SegmentProvider } from '@salutejs/plasma-b2c';
import { IconAddOutline } from '@salutejs/plasma-icons';

import { Segment } from '../../components';

const Root = styled.div`
    display: flex;
    position: absolute;
    gap: 0.5rem;
    top: -3rem;
    left: 0.125rem;
`;

interface ConfigItem {
    value: string;
    label: string;
}

interface ComponentAppearanceProps {
    configItem: ConfigItem;
    configItems: ConfigItem[];
    onChangeAppearance: (value: ConfigItem) => void;
}

export const ComponentAppearance = (props: ComponentAppearanceProps) => {
    const { configItems, configItem, onChangeAppearance } = props;

    return (
        <Root>
            <SegmentProvider defaultSelected={[configItem.value]} singleSelectedRequired>
                <Segment
                    items={configItems}
                    pilled={false}
                    setActiveItem={onChangeAppearance}
                    view="secondary"
                    hasBackground
                />
            </SegmentProvider>
            <IconButton size="xs" view="clear">
                <IconAddOutline size="s" />
            </IconButton>
        </Root>
    );
};
