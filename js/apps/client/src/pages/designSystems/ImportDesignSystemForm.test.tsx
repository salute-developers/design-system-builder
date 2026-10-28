import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ThemeFile } from '../../modules/designSystems/domain/designSystem';

const { readThemeFile } = vi.hoisted(() => ({ readThemeFile: vi.fn() }));
vi.mock('../../modules/designSystems/application/themeFile', () => ({ readThemeFile }));

import { ImportDesignSystemForm } from './ImportDesignSystemForm';

const themeFile = (name: string): ThemeFile => ({ meta: { name, version: null, tokens: [] }, variations: {} });

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const choose = (name: string) =>
    fireEvent.change(screen.getByLabelText('Файл темы'), { target: { files: [new File(['{}'], name)] } });

afterEach(cleanup);

it.each([
    ['result', (read: ReturnType<typeof deferred<ThemeFile>>) => read.resolve(themeFile('from-zip'))],
    ['error', (read: ReturnType<typeof deferred<ThemeFile>>) => read.reject(new Error('BROKEN'))],
])('ignores the late %s of reading a previously chosen file', async (_, finishFirst) => {
    const first = deferred<ThemeFile>();
    const second = deferred<ThemeFile>();
    readThemeFile.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(
        <MemoryRouter>
            <ImportDesignSystemForm projectId="project-1" projectName="Platform" onImported={vi.fn()} />
        </MemoryRouter>,
    );

    choose('a.zip');
    choose('b.json');
    await act(async () => second.resolve(themeFile('from-json')));
    await act(async () => finishFirst(first));

    expect(screen.getByText('b.json')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('from-json');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('locks the file field while the chosen file is being read', async () => {
    const read = deferred<ThemeFile>();
    readThemeFile.mockReturnValueOnce(read.promise);
    render(
        <MemoryRouter>
            <ImportDesignSystemForm projectId="project-1" projectName="Platform" onImported={vi.fn()} />
        </MemoryRouter>,
    );

    choose('a.zip');
    expect(screen.getByLabelText('Файл темы')).toBeDisabled();
    expect(screen.getByText('Читаем a.zip…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Импортировать' })).toBeDisabled();

    await act(async () => read.resolve(themeFile('from-zip')));
    expect(screen.getByLabelText('Файл темы')).toBeEnabled();
    expect(screen.getByText('a.zip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Импортировать' })).toBeEnabled();
});
