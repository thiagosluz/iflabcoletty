<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use App\Models\FileTransfer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FileTransferController extends Controller
{
    /**
     * Upload a file or register a link for transfer.
     */
    public function upload(Request $request)
    {
        $validated = $request->validate([
            'source_type' => 'required|in:upload,link,network_path',
            'file' => 'required_if:source_type,upload|file|max:102400', // 100MB Limit
            'content' => 'required_if:source_type,link,network_path|nullable|string',
            'filename' => 'required_if:source_type,link,network_path|nullable|string|max:255',
        ]);

        $path = null;
        $filename = $validated['filename'] ?? null;

        if ($validated['source_type'] === 'upload') {
            if (! $request->hasFile('file')) {
                return response()->json(['message' => 'File is required for upload type'], 422);
            }
            $file = $request->file('file');
            $filename = $file->getClientOriginalName();
            // Store in temp_transfers directory
            $path = $file->store('temp_transfers');
        } else {
            $path = $validated['content'];
        }

        $transfer = FileTransfer::create([
            'filename' => $filename,
            'source_type' => $validated['source_type'],
            'file_path' => $path,
            'created_by' => auth()->id(),
            'expires_at' => now()->addHours(24),
        ]);

        return response()->json($transfer, 201);
    }

    /**
     * Send the file/link to targets (Computers or Labs).
     */
    public function send(Request $request)
    {
        $validated = $request->validate([
            'file_transfer_id' => 'required|exists:file_transfers,id',
            'targets' => 'required|array',
            'targets.computers' => 'array',
            'targets.computers.*' => 'exists:computers,id',
            'targets.labs' => 'array',
            'targets.labs.*' => 'exists:labs,id',
        ]);

        $transfer = FileTransfer::findOrFail($validated['file_transfer_id']);

        $targetComputerIds = collect($validated['targets']['computers'] ?? []);

        // Expand Labs to Computers
        if (! empty($validated['targets']['labs'])) {
            $labComputerIds = Computer::whereIn('lab_id', $validated['targets']['labs'])->pluck('id');
            $targetComputerIds = $targetComputerIds->merge($labComputerIds)->unique();
        }

        if ($targetComputerIds->isEmpty()) {
            return response()->json(['message' => 'No target computers found.'], 422);
        }

        $commandParams = [
            'filename' => $transfer->filename,
            'source_type' => $transfer->source_type,
            'destination_folder' => 'public_desktop',
        ];

        if ($transfer->source_type === 'upload') {
            // URL for agent to download
            $commandParams['url'] = route('api.v1.transfers.download', ['fileTransfer' => $transfer->id]);
            $commandParams['file_id'] = $transfer->id; // Optional hint
            $commandParams['auth_required'] = true;
        } else {
            // Link or Network Path
            $commandParams['url'] = $transfer->file_path; // Can be http://... or \\Server\Share
        }

        $computers = Computer::whereIn('id', $targetComputerIds)->get();
        $count = 0;

        foreach ($computers as $computer) {
            $computer->commands()->create([
                'user_id' => auth()->id(),
                'command' => 'receive_file',
                'parameters' => $commandParams,
                'status' => 'pending',
            ]);
            $count++;
        }

        return response()->json([
            'message' => "File transfer initiated for {$count} computers.",
            'command_count' => $count,
        ]);
    }

    /**
     * Download the file (for Agent or Admin).
     */
    public function download(FileTransfer $fileTransfer)
    {
        if ($fileTransfer->source_type !== 'upload') {
            return response()->json(['message' => 'This transfer is not a file upload.'], 400);
        }

        if (! Storage::exists($fileTransfer->file_path)) {
            return response()->json(['message' => 'File not found on server (might be expired).'], 404);
        }

        return Storage::download($fileTransfer->file_path, $fileTransfer->filename);
    }
}
