import apiClient from '@/lib/axios';

export interface FileTransfer {
    id: number;
    filename: string;
    source_type: 'upload' | 'link' | 'network_path';
    file_path: string;
    expires_at: string;
}

export interface SendFileParams {
    file_transfer_id: number;
    targets: {
        computers?: number[];
        labs?: number[];
    };
}

const FileTransferService = {
    upload: async (file: File): Promise<FileTransfer> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_type', 'upload');

        const response = await apiClient.post('/transfers/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    registerLink: async (url: string, type: 'link' | 'network_path', filename?: string): Promise<FileTransfer> => {
        const response = await apiClient.post('/transfers/upload', {
            source_type: type,
            content: url,
            filename: filename || url.split('/').pop() || 'link',
        });
        return response.data;
    },

    send: async (params: SendFileParams): Promise<{ message: string; command_count: number }> => {
        const response = await apiClient.post('/transfers/send', params);
        return response.data;
    },
};

export default FileTransferService;
