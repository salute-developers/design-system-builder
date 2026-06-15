import { useMemo, useState } from 'react';

import {
    IconButtonStories,
    LinkStories,
    ButtonStories,
    CheckboxStories,
    RadioboxStories,
    CounterStories,
    IndicatorStories,
    BadgeStories,
    SpinnerStories,
    ChipStories,
} from '../stories';

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
    Counter: CounterStories,
    Indicator: IndicatorStories,
    Badge: BadgeStories,
    Spinner: SpinnerStories,
    Chip: ChipStories,
};

export const useStory = (componentName?: string) => {
    const [selectedStory, setSelectedStory] = useState({ value: 'Default', label: 'Default' });

    const stories = (componentName && componentMapper[componentName]) || [];
    const items = stories.map(({ name }) => ({ value: name, label: name }));

    const story = useMemo(
        () => stories.find(({ name }) => name === selectedStory.value),
        [componentName, selectedStory],
    );

    return {
        storyArgs: story?.args ?? [],
        items,
        selectedStory,
        setSelectedStory,
        Story: story?.render,
    } as const;
};
