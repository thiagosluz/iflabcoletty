
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from './Dashboard';
import { MemoryRouter } from 'react-router-dom';

// Mock path alias resolution if needed, but vitest usually handles it if configured.
// We mocked @/lib/axios. Let's ensure it has a default export.
vi.mock('@/lib/axios', () => {
    return {
        default: {
            get: vi.fn(),
        },
    };
});

// Mock Recharts
vi.mock('recharts', async () => {
    const OriginalModule = await vi.importActual('recharts');
    return {
        ...OriginalModule,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ResponsiveContainer: ({ children }: any) => <div style={{ width: 800, height: 400 }}>{children}</div>,
    };
});

// Mock echo
vi.mock('@/lib/echo', () => ({
    default: {
        private: () => ({
            listen: vi.fn().mockReturnThis(),
            leave: vi.fn(),
        }),
        leave: vi.fn()
    }
}));


describe('Dashboard Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state initially', async () => {
        const { default: api } = await import('@/lib/axios');
        vi.mocked(api.get).mockImplementation(() => new Promise(() => { })); // Never resolves

        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
        expect(screen.getByText('Carregando dashboard...')).toBeInTheDocument();
    });

    it('renders stats after data fetch', async () => {
        const { default: api } = await import('@/lib/axios');

        const mockStats = {
            total_labs: 5,
            total_computers: 120,
            online_computers: 100,
            offline_computers: 20,
            total_softwares: 10,
            hardware_averages: null,
            os_distribution: [],
            outdated_agents: 0,
            installations_in_progress: 0
        };

        const mockActivity = [
            { hour: new Date().toISOString(), avg_cpu: 10, avg_memory: 20 }
        ];

        (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
            if (url.includes('stats')) return Promise.resolve({ data: mockStats });
            if (url.includes('history')) return Promise.resolve({ data: mockActivity });
            if (url.includes('/labs')) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: {} });
        });

        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('120')).toBeInTheDocument(); // Total computers
            expect(screen.getByText('5')).toBeInTheDocument();   // Total labs
        });
    });
});
