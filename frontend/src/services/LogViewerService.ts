import apiClient from '@/lib/axios';

export interface LogFile {
    filename: string;
    size: number;
    last_modified: number;
    formatted_size: string;
    formatted_last_modified: string;
}

export interface LogContent {
    filename: string;
    content: string;
    size: number;
    truncated?: boolean;
    from_line?: number;
    total_lines?: number | null;
}

export interface GetFileContentParams {
    tail?: number;
}

export interface LogEntry {
    id: number;
    timestamp: string | null;
    env: string | null;
    level: string | null;
    message: string;
    lineNumber: number;
}

export interface LogEntriesResponse {
    data: LogEntry[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

export interface LogEntriesParams {
    page?: number;
    per_page?: number;
    level?: string | null;
    search?: string | null;
    order?: 'newest' | 'oldest';
}

export interface LogLevelStats {
    levels: Record<string, number>;
}

const LogViewerService = {
    getFiles: async (): Promise<LogFile[]> => {
        const response = await apiClient.get('/system/logs');
        return response.data;
    },

    getFileContent: async (filename: string, params?: GetFileContentParams): Promise<LogContent> => {
        const searchParams = new URLSearchParams();
        if (params?.tail != null) {
            searchParams.set('tail', String(params.tail));
        }
        const query = searchParams.toString();
        const url = `/system/logs/${encodeURIComponent(filename)}${query ? `?${query}` : ''}`;
        const response = await apiClient.get(url);
        return response.data;
    },

    downloadFile: async (filename: string): Promise<Blob> => {
        const response = await apiClient.get(`/system/logs/${encodeURIComponent(filename)}/download`, {
            responseType: 'blob',
        });
        return response.data;
    },

    getLogEntries: async (filename: string, params?: LogEntriesParams): Promise<LogEntriesResponse> => {
        const searchParams = new URLSearchParams();
        if (params?.page != null) searchParams.set('page', String(params.page));
        if (params?.per_page != null) searchParams.set('per_page', String(params.per_page));
        if (params?.level != null && params.level !== '') searchParams.set('level', params.level);
        if (params?.search != null && params.search !== '') searchParams.set('search', params.search);
        if (params?.order != null) searchParams.set('order', params.order);
        const query = searchParams.toString();
        const url = `/system/logs/${encodeURIComponent(filename)}/entries${query ? `?${query}` : ''}`;
        const response = await apiClient.get(url);
        return response.data;
    },

    getLogStats: async (filename: string): Promise<LogLevelStats> => {
        const response = await apiClient.get(`/system/logs/${encodeURIComponent(filename)}/stats`);
        return response.data;
    },
};

export default LogViewerService;
