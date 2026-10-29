import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useStory } from './useStory';

describe('useStory', () => {
    it('keeps the story args reference stable for a component without stories', () => {
        const { result, rerender } = renderHook(() => useStory(undefined));
        const first = result.current.storyArgs;

        rerender();

        // Эффекты редактора зависят от `storyArgs`: новая ссылка на каждый render зацикливает Compose-компонент.
        expect(result.current.storyArgs).toBe(first);
    });
});
