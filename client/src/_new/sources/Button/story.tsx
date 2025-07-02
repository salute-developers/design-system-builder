import { IconPlasma, IconShazam } from '@salutejs/plasma-icons';
import { component, buttonConfig, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

interface ButtonStoryProps {
    args: any;
}

const Button = component(mergeConfig(buttonConfig as any, {}));

export const ButtonStory = (props: ButtonStoryProps) => {
    const { args } = props;

    const onClick = () => {
        alert('onClick');
    };

    return (
        <Button
            onClick={onClick}
            {...args}
            contentLeft={args.enableContentLeft ? <IconPlasma color="inherit" /> : undefined}
            contentRight={args.enableContentRight ? <IconShazam color="inherit" /> : undefined}
        />
    );
};
