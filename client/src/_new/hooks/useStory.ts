import { useEffect, useMemo, useState } from 'react';

import { IconButtonStories, LinkStories, ButtonStories, CheckboxStories, RadioboxStories } from '../stories';

interface Story {
    name: string;
    args: Record<string, any>[];
    render: (props: any) => JSX.Element;
}

const componentMapper: Record<string, Story[]> = {
    IconButton: IconButtonStories,
    Link: LinkStories,
    Button: ButtonStories,
    Checkbox: CheckboxStories,
    Radiobox: RadioboxStories,
};

export const useStory = (componentName: string, onUpdateComponentProps: (values: Record<string, any>) => void) => {
    const [selectedStory, setSelectedStory] = useState({ value: 'Default', label: 'Default' });

    const items = componentMapper[componentName].map(({ name }) => ({ value: name, label: name }));

    const story = useMemo(
        () => componentMapper[componentName].find(({ name }) => name === selectedStory.value)!,
        [componentName, selectedStory],
    );

    useEffect(() => {
        const values = story.args.reduce((acc, { name, value }) => ({ ...acc, [name]: value }), {});

        if (values) {
            onUpdateComponentProps(values);
        }
    }, [selectedStory]);

    return [selectedStory, setSelectedStory, story.args, items, story.render] as const;
};
