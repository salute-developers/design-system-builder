import { IconPlasma } from '@salutejs/plasma-icons';
import { component, iconButtonConfig, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

interface IconButtonStoryProps {
    args: any;
}

const IconButton = component(mergeConfig(iconButtonConfig as any, {}));

export const IconButtonStory = (props: IconButtonStoryProps) => {
    const { args } = props;

    const onClick = () => {
        alert('onClick');
    };

    return (
        <IconButton onClick={onClick} {...args}>
            <IconPlasma color="inherit" />
        </IconButton>
    );
};
