import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ValidationPage } from './ValidationPage';
import { issue, report, context } from '../../features/coreCompatibility/testFixtures';
const mocks = vi.hoisted(() => ({
    report: vi.fn(),
    error: undefined as string | undefined,
    reload: vi.fn(),
    targets: vi.fn(),
    repair: vi.fn(),
    read: vi.fn(),
    readOnly: false,
}));
vi.mock('../../hooks/useCoreCompatibility', () => ({
    useCoreCompatibility: () => ({ report: mocks.report(), error: mocks.error, reload: mocks.reload }),
}));
vi.mock('../../api/coreCompatibilityRepository', () => ({ coreCompatibilityRepository: mocks }));
vi.mock('react-router-dom', async (original) => ({
    ...(await original<typeof import('react-router-dom')>()),
    useOutletContext: () => ({
        designSystem: { getName: () => 'Test DS', getParameters: () => ({ ...context, readOnly: mocks.readOnly }) },
        reload: mocks.reload,
    }),
}));
vi.mock('../../components/BuilderShell/BuilderShell', () => ({
    SettingsFrame: ({
        sections,
        children,
        aside,
        asideFooter,
        sectionBadges,
        sectionActions,
    }: {
        sections: string[];
        children: ReactNode;
        aside: ReactNode;
        asideFooter?: ReactNode;
        sectionBadges?: Record<string, number>;
        sectionActions?: Record<string, ReactNode>;
    }) => (
        <>
            <nav>
                {sections.join(',')}
                <span data-testid="nav-count">{sectionBadges?.compatibility}</span>
            </nav>
            <main>
                <header>{sectionActions?.compatibility}</header>
                {children}
            </main>
            <aside>
                {aside}
                <footer>{asideFooter}</footer>
            </aside>
        </>
    ),
}));
const Location = () => {
    const l = useLocation();
    return (
        <p data-testid="location">
            {l.pathname}
            {l.search}
        </p>
    );
};
const show = (search = '') =>
    render(
        <MemoryRouter initialEntries={['/themes/t/validation' + search]}>
            <ValidationPage />
            <Location />
        </MemoryRouter>,
    );
beforeEach(() => {
    vi.clearAllMocks();
    mocks.readOnly = false;
    mocks.error = undefined;
    mocks.report.mockReturnValue(report());
    mocks.targets.mockResolvedValue([]);
});
afterEach(cleanup);
it('groups blocking issues, excludes ApiDeprecated, shows details on the right and opens the assignment', () => {
    mocks.report.mockReturnValue({
        ...report(),
        items: [issue, { ...issue, issueId: 'deprecated', code: 'CORE_PROPERTY_DEPRECATED', severity: 'warning' }],
    });
    show('?versionId=v');
    expect(screen.getByRole('navigation')).toHaveTextContent('Совместимость');
    expect(screen.queryByText('Свойство устарело')).not.toBeInTheDocument();
    expect(within(screen.getByRole('complementary')).getByText('background.accent (токен)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Перейти к свойству' }));
    expect(screen.getByTestId('location')).toHaveTextContent('versionId=v');
    expect(screen.getByTestId('location')).toHaveTextContent('configuration=appearance');
    expect(screen.getByTestId('location')).toHaveTextContent('section=style');
});
it('keeps native-platform diagnostics without mutations or an unsupported editor link', () => {
    mocks.report.mockReturnValue(report({ ...issue, location: { ...issue.location, platform: 'ios' } }));
    show();
    expect(screen.queryByRole('button', { name: 'Удалить назначение' })).not.toBeInTheDocument();
    expect(mocks.targets).not.toHaveBeenCalled();
    expect(mocks.repair).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Перейти к свойству' })).not.toBeInTheDocument();
});
it('does not offer repair for history and explains a disappeared deep link', () => {
    show('?versionId=history&issueId=gone');
    expect(screen.queryByRole('button', { name: 'Удалить назначение' })).not.toBeInTheDocument();
    expect(screen.getByText(/Выбранная проблема больше не найдена/)).toBeInTheDocument();
});

it('shows both report counters and offers a separate quick-jump icon', () => {
    show();
    expect(screen.getByTestId('nav-count')).toHaveTextContent('1');
    expect(screen.getByLabelText('Всего проблем')).toHaveTextContent('1');
    expect(screen.queryByText('Проблем: 1')).not.toBeInTheDocument();
    const quick = screen.getByRole('button', { name: /Перейти к проблеме:/ });
    fireEvent.click(quick);
    expect(screen.getByTestId('location')).toHaveTextContent('configuration=appearance');
});

it('offers retry after an error even if the last report had no problems', () => {
    mocks.report.mockReturnValue({ ...report(), items: [], blockingCount: 0 });
    mocks.error = 'network unavailable';
    show();
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось проверить совместимость');
    expect(screen.queryByText('Проблем совместимости нет')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Всего проблем')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-count')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(mocks.reload).toHaveBeenCalledOnce();
});
