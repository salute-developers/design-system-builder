import { useEffect, useMemo, useState } from 'react';

import { SelectButtonItem } from '../components';
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
    SwitchStories,
    SkeletonStories,
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
    Switch: SwitchStories,
    Skeleton: SkeletonStories,
};

export const useStory = (componentName?: string) => {
    const [selectedStory, setSelectedStory] = useState<SelectButtonItem>({ value: 'Default', label: 'Default' });

    const stories = (componentName && componentMapper[componentName]) || [];
    const items: SelectButtonItem[] = stories.map(({ name }) => ({ value: name, label: name }));

    useEffect(() => {
        setSelectedStory({ value: 'Default', label: 'Default' });
    }, [componentName]);

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
