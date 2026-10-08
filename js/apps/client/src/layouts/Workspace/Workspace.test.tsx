import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Workspace } from './Workspace';

afterEach(cleanup);

describe('Workspace read-only mode', () => {
    it('makes both editor regions inert without adding a layout wrapper', () => {
        const { container } = render(
            <Workspace
                section="overview"
                readOnly
                menu={<button type="button">Menu action</button>}
                content={<input aria-label="Editable value" defaultValue="before" />}
            />,
        );

        const menu = screen.getByTestId('editor-workspace-menu');
        const content = screen.getByTestId('editor-workspace-content');

        expect((menu as HTMLDivElement & { inert: boolean }).inert).toBe(true);
        expect((content as HTMLDivElement & { inert: boolean }).inert).toBe(true);
        expect(content).toHaveAttribute('data-editor-section', 'overview');
        expect(container.children).toHaveLength(2);
        expect([...container.children]).toEqual(expect.arrayContaining([menu, content]));
    });

    it('keeps an editable workspace interactive', () => {
        render(<Workspace section="colors" content={<input aria-label="Editable value" />} />);

        expect((screen.getByTestId('editor-workspace-content') as HTMLDivElement & { inert: boolean }).inert).toBe(
            false,
        );
    });
});
