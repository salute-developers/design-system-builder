import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Config, type DesignSystem, type Theme } from '../../controllers';
import { ComponentEditor } from '../../pages/components/features/ComponentEditor/ComponentEditor';
import { chipMeta } from '../../pages/components/features/__fixtures__/chipMeta';
import { issue, context, report } from './testFixtures';
import type { CoreIssue } from '../../api/coreCompatibilityRepository';
vi.mock('../../pages/components/features/ComponentEditorPreview', () => ({
    ComponentEditorPreview: ({ args }: { args: unknown }) => <p data-testid="preview">{JSON.stringify(args)}</p>,
}));
const config = () => new Config({ ...chipMeta, serverBinding: { componentId: 'button', appearanceId: 'config' } });
const theme = { getTokens: () => [], getRevision: () => 0, getTokenValue: () => undefined } as unknown as Theme;
const designSystem = {
    getComponentData: () => ({ sources: chipMeta.sources }),
    resolveComposeStyleReference: vi.fn(),
} as unknown as DesignSystem;
const missing: CoreIssue = {
    ...issue,
    location: { ...issue.location, appearanceId: 'config', styleIds: ['s-xs'], styleLabels: ['size=xs'] },
};
const show = (item = missing, search = '') =>
    render(
        <MemoryRouter initialEntries={['/themes/t/components/compose-Chip' + search]}>
            <ComponentEditor
                configs={[config()]}
                designSystem={designSystem}
                theme={theme}
                updated={{}}
                platforms={[]}
                onPlatformSelect={vi.fn()}
                onConfigUpdate={vi.fn()}
                onCompatibilityReload={vi.fn()}
                compatibility={{ context, report: report(item), readOnly: true, onRepaired: vi.fn() }}
            />
        </MemoryRouter>,
    );
beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
});
afterEach(cleanup);
it('keeps ApiDeprecated as a warning tooltip in styling without a problem tab', async () => {
    show({
        ...missing,
        code: 'CORE_PROPERTY_DEPRECATED',
        severity: 'warning',
        location: { ...missing.location, propertyId: 'height' },
    });
    expect(screen.queryByRole('tab', { name: 'Проблемы' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Size' }), { target: { value: 's-m' } });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByLabelText('Свойство устарело'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Свойство устарело');
});
it('lists all assignments and navigates to an absent property in another size', async () => {
    show(missing, '?section=problems');
    expect(screen.getByRole('tab', { name: 'Проблемы' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Удалить назначение')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Перейти к свойству/ }));
    await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent('s-xs'));
    expect(screen.getByRole('tab', { name: 'Стилизация' })).toHaveAttribute('aria-selected', 'true');
    const row = screen.getByRole('article');
    expect(row).toHaveClass('core-assignment-row');
    expect(row).toHaveTextContent('Old fill');
    expect(within(row).getByRole('textbox')).toHaveValue('background.accent');
    expect(row).not.toHaveTextContent('size=xs');
    expect(screen.queryByText('Перенести значение')).not.toBeInTheDocument();
    expect(row).toHaveTextContent('hovered');
});
it('restores exact intersection and highlights the row when opened by URL', async () => {
    const combination = {
        ...missing,
        location: { ...missing.location, valueKind: 'combination', styleIds: ['s-xs', 'v-accent'] },
    };
    show(combination, `?section=style&issueId=${encodeURIComponent(combination.issueId)}`);
    await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent('v-accent'));
    expect(screen.getByTestId('preview')).toHaveTextContent('s-xs');
    expect(within(screen.getByRole('article')).getByRole('textbox')).toHaveValue('background.accent');
    expect(screen.getByRole('combobox', { name: 'Size' })).toHaveValue('s-xs');
    expect(screen.getByRole('combobox', { name: 'View' })).toHaveValue('v-accent');
});

it('does not reset a manually selected size when the same report is polled again', async () => {
    const model = config();
    const element = () => (
        <MemoryRouter
            initialEntries={[
                `/themes/t/components/compose-Chip?section=style&issueId=${encodeURIComponent(missing.issueId)}`,
            ]}
        >
            <ComponentEditor
                configs={[model]}
                designSystem={designSystem}
                theme={theme}
                updated={{}}
                platforms={[]}
                onPlatformSelect={vi.fn()}
                onConfigUpdate={vi.fn()}
                compatibility={{ context, report: report({ ...missing }), readOnly: true, onRepaired: vi.fn() }}
            />
        </MemoryRouter>
    );
    const view = render(element());
    await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent('s-xs'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Size' }), { target: { value: 's-m' } });
    expect(screen.getByTestId('preview')).toHaveTextContent('s-m');
    view.rerender(element());
    expect(screen.getByTestId('preview')).toHaveTextContent('s-m');
});

it('shows the saved raw value when it cannot be represented by the new property type', async () => {
    const conflict = {
        ...missing,
        code: 'CORE_VALUE_TYPE_CONFLICT',
        location: { ...missing.location, propertyId: 'height', propertyName: 'height', styleIds: ['s-m'], states: [] },
        storedValue: { ...missing.storedValue!, tokenId: null, tokenName: null, literal: 'old-literal' },
    };
    show(conflict, `?section=style&issueId=${encodeURIComponent(conflict.issueId)}`);
    await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent('s-m'));
    const row = document.querySelector('[data-property="height"]') as HTMLElement;
    expect(within(row).getByRole('textbox')).toHaveValue('old-literal');
    expect(within(row).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Перенести значение')).not.toBeInTheDocument();
});

it('clears unrelated selected styles when navigating to a problem of a single style', async () => {
    show();
    fireEvent.change(screen.getByRole('combobox', { name: 'Size' }), { target: { value: 's-m' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'v-accent' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Проблемы' }));
    fireEvent.click(screen.getByRole('button', { name: /Перейти к свойству/ }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Size' })).toHaveValue('s-xs'));
    expect(screen.getByRole('combobox', { name: 'View' })).toHaveValue('');
    expect(screen.getByTestId('preview')).not.toHaveTextContent('v-accent');
    expect(within(screen.getByRole('article')).getByRole('textbox')).toHaveValue('background.accent');
});
