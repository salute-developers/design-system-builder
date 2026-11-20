import { cloneElement, useState, type ReactElement } from 'react';

import { InspectorStoryArgs } from '../ComponentInspector/InspectorStoryArgs';
import type { StoryArgs } from './storyArgs';

const Harness = ({ preview }: { preview: ReactElement }) => {
    const [storyArgs, setStoryArgs] = useState<StoryArgs>();
    return (
        <>
            {cloneElement(preview, { onStoryArgsChange: setStoryArgs })}
            <InspectorStoryArgs storyArgs={storyArgs} />
        </>
    );
};

/** Превью вместе со строками аргументов story, как их связывает редактор: превью отдаёт модель, инспектор рисует. */
export const withStoryArgs = (preview: ReactElement) => <Harness preview={preview} />;
