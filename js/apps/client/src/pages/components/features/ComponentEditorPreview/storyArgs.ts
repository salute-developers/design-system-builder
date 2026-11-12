import type { PreviewExamplePropertyDescription } from '../../../../composePreview';

export type StoryArgValue = string | number | boolean;

/** Аргументы story активного рендерера превью: их показывает инспектор, значения живут в превью. */
export interface StoryArgs {
    /** Меняется вместе с рендерером, компонентом и story: строки с черновиками пересоздаются. */
    key: string;
    properties: PreviewExamplePropertyDescription[];
    values: Record<string, StoryArgValue>;
    onChange: (name: string, value: StoryArgValue) => void;
}
