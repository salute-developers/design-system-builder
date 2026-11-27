import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { authService } from '../../api';
import { Login } from './Login';

beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: { ready: Promise.resolve() },
    });
});
afterEach(cleanup);

describe('login', () => {
    it('opens the projects list after a successful login without requiring an owner project', async () => {
        const login = vi.spyOn(authService, 'login').mockResolvedValue();
        render(
            <MemoryRouter initialEntries={['/login']}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/projects" element={<div>Project list</div>} />
                </Routes>
            </MemoryRouter>,
        );

        fireEvent.change(screen.getByPlaceholderText('Введите логин'), { target: { value: 'registered-user' } });
        fireEvent.change(screen.getByPlaceholderText('Введите пароль'), { target: { value: 'secret' } });
        fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

        await waitFor(() => expect(login).toHaveBeenCalledWith('registered-user', 'secret'));
        expect(await screen.findByText('Project list')).toBeInTheDocument();
    });
});

const Destination = () => {
    const location = useLocation();
    return <div>{location.pathname + location.search}</div>;
};

it.each([
    ['/projects/p/design-systems/d?versionId=published', '/projects/p/design-systems/d?versionId=published'],
    ['https://example.com', '/projects'],
    ['//example.com', '/projects'],
    ['/\\example.com', '/projects'],
    ['/\n//example.com', '/projects'],
])('returns only to a safe local address after login: %s', async (returnTo, expected) => {
    vi.spyOn(authService, 'login').mockResolvedValue();
    render(
        <MemoryRouter initialEntries={[`/login?returnTo=${encodeURIComponent(returnTo)}`]}>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Destination />} />
            </Routes>
        </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText('Введите логин'), { target: { value: 'member' } });
    fireEvent.change(screen.getByPlaceholderText('Введите пароль'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
});
