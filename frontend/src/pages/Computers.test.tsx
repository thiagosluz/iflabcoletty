
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Computers from './Computers';
import { MemoryRouter } from 'react-router-dom';

// Mock mocks
vi.mock('@/lib/axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

vi.mock('@/lib/echo', () => ({
    default: {
        private: () => ({
            listen: vi.fn().mockReturnThis(),
            leave: vi.fn(),
        }),
        leave: vi.fn()
    }
}));

describe('Computers Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders and fetches computers', async () => {
        const { default: api } = await import('@/lib/axios');

        const mockComputers = {
            data: [
                {
                    id: 1,
                    hostname: 'COMP-01',
                    machine_id: 'MID-01',
                    ip_address: '192.168.1.101',
                    status: 'online',
                    is_active: true,
                    lab: { name: 'Lab 1' },
                    updated_at: new Date().toISOString()
                },
                {
                    id: 2,
                    hostname: 'COMP-02',
                    machine_id: 'MID-02',
                    ip_address: '192.168.1.102',
                    status: 'online',
                    is_active: true,
                    lab: { name: 'Lab 1' },
                    updated_at: new Date(Date.now() - 10000000).toISOString() // Old date for offline check logic if relevant
                }
            ],
            // Add pagination meta structure expected by the component
            current_page: 1,
            last_page: 1,
            per_page: 20,
            total: 2,
            from: 1,
            to: 2
        };

        // Mock get implementation
        vi.mocked(api.get).mockImplementation((url: string) => {
            if (url.includes('/computers')) return Promise.resolve({ data: mockComputers });
            if (url.includes('/labs')) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter>
                <Computers />
            </MemoryRouter>
        );

        // Check for correct title
        expect(screen.getByRole('heading', { name: /computadores/i })).toBeInTheDocument();

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('COMP-01')).toBeInTheDocument();
            expect(screen.getByText('COMP-02')).toBeInTheDocument();
            // machine_id is also rendered
            expect(screen.getByText('MID-01')).toBeInTheDocument();
        });
    });
});
