import { component, linkConfig, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

interface LinkStoryProps {
    args: any;
}

const Link = component(mergeConfig(linkConfig, {}));

export const LinkStory = (props: LinkStoryProps) => {
    const { args } = props;

    const onClick = () => {
        alert('onClick');
    };

    return (
        <Link onClick={onClick} {...args}>
            {args.text}
        </Link>
    );
};
