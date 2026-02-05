import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

// Mock useAuth since Login probably uses it
vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        login: vi.fn(),
        loading: false
    })
}));

describe('Login Page', () => {
    it('renders login form', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        // Check for main elements
        expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    });
});
