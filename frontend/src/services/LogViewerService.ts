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
}

const LogViewerService = {
    getFiles: async (): Promise<LogFile[]> => {
        const response = await apiClient.get('/system/logs');
        return response.data;
    },

    getFileContent: async (filename: string): Promise<LogContent> => {
        const response = await apiClient.get(`/system/logs/${filename}`);
        return response.data;
    }
};

export default LogViewerService;
