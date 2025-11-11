import { useLayoutEffect, useMemo, useState } from 'react';

import { IconButtonStories, LinkStories, ButtonStories, CheckboxStories, RadioboxStories } from '../stories';
import { Config } from '../controllers';

interface Story {
    name: string;
    args: Record<string, any>[];
    render: (props: any) => JSX.Element;
}

// TODO: Подумать как сделать автоматически расширяемый список
const componentMapper: Record<string, Story[]> = {
    IconButton: IconButtonStories,
    Link: LinkStories,
    Button: ButtonStories,
    Checkbox: CheckboxStories,
    Radiobox: RadioboxStories,
};

export const useStory = (
    componentName: string,
    config: Config,
    onUpdateComponentProps: (values: Record<string, any>) => void,
) => {
    const [selectedStory, setSelectedStory] = useState({ value: 'Default', label: 'Default' });

    const items = componentMapper[componentName].map(({ name }) => ({ value: name, label: name }));

    const story = useMemo(
        () => componentMapper[componentName].find(({ name }) => name === selectedStory.value)!,
        [componentName, selectedStory],
    );

    useLayoutEffect(() => {
        const values = story.args.reduce((acc, { name, value }) => ({ ...acc, [name]: value }), {});

        if (values) {
            onUpdateComponentProps(values);
        }
    }, [selectedStory, config]);

    return { selectedStory, setSelectedStory, storyArgs: story.args, items, Story: story.render } as const;
};
