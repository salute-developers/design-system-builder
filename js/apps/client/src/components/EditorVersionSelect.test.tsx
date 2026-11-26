import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { EditorVersionSelect } from './EditorVersionSelect';

const waitForSave = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../features/versionJournal/useVersionList', () => ({
    useVersionList: () => ({
        versions: [
            { id: 'published-1', version: '1.0.0', sequenceNumber: 1 },
            { id: 'published-2', version: '2.0.0', sequenceNumber: 2 },
        ],
        loading: false,
        error: undefined,
        reload: vi.fn(),
    }),
}));
vi.mock('../api/draftAutosaveActivity', () => ({
    waitForDraftAutosaveIdle: waitForSave,
    hasPersistedComponentMutation: () => false,
}));
vi.mock('./Overlay/Overlay', () => ({
    StyledSelect: ({
        label,
        value,
        options,
        onChange,
    }: {
        label: string;
        value: string;
        options: Array<{ value: string; label: string }>;
        onChange: (value: string) => void;
    }) => (
        <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    ),
}));
const Destination = () => {
    const location = useLocation();
    return <p>{location.pathname + location.search}</p>;
};
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

it('offers only publications and opens their own themes without waiting for draft autosave', async () => {
    render(
        <MemoryRouter initialEntries={['/projects/p/design-systems/d/themes/t/colors?version=1.0.0']}>
            <Routes>
                <Route
                    path="/projects/p/design-systems/d/themes/t/colors"
                    element={
                        <EditorVersionSelect
                            context={{ projectId: 'p', designSystemId: 'd', tenantId: 't', versionId: 'published-1' }}
                            publishedOnly
                            selectedVersion="1.0.0"
                        />
                    }
                />
                <Route path="*" element={<Destination />} />
            </Routes>
        </MemoryRouter>,
    );
    expect(screen.queryByRole('option', { name: 'Черновик' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('published-1');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'published-2' } });
    expect(await screen.findByText('/projects/p/design-systems/d?versionId=published-2')).toBeInTheDocument();
    expect(waitForSave).not.toHaveBeenCalled();
});

it('preserves project draft selection and the existing autosave wait', async () => {
    render(
        <MemoryRouter initialEntries={['/editor']}>
            <Routes>
                <Route
                    path="/editor"
                    element={<EditorVersionSelect context={{ projectId: 'p', designSystemId: 'd', tenantId: 't' }} />}
                />
            </Routes>
        </MemoryRouter>,
    );
    expect(screen.getByRole('option', { name: 'Черновик' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'published-2' } });
    await vi.waitFor(() => expect(waitForSave).toHaveBeenCalledOnce());
});
