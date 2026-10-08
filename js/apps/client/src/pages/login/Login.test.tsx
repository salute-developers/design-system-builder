import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
