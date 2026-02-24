<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class AgentAuthController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'installation_token' => 'required|string',
            'hardware_info' => 'required|array',
            'hostname' => 'required|string',
            'agent_version' => 'required|string',
            'wol_mac' => 'nullable|string',
        ]);

        $lab = \App\Models\Lab::where('installation_token', $request->installation_token)->first();

        if (! $lab) {
            return response()->json(['message' => 'Invalid installation token'], 401);
        }

        // Generate a new plain API key for this agent
        $plainApiKey = \Illuminate\Support\Str::random(60);
        $hashedApiKey = hash('sha256', $plainApiKey);

        // Hardware info represents the unique fingerprint of the machine
        $machineId = md5(json_encode($request->hardware_info));

        // Let's check if the computer already exists or register a new one
        $computer = \App\Models\Computer::updateOrCreate(
            ['machine_id' => $machineId],
            [
                'lab_id' => $lab->id,
                'hostname' => $request->hostname,
                'hardware_info' => $request->hardware_info,
                'agent_version' => $request->agent_version,
                'wol_mac' => $request->wol_mac,
                'agent_api_key' => $hashedApiKey,
            ]
        );

        return response()->json([
            'message' => 'Agent registered successfully',
            'api_key' => $plainApiKey,
            'computer_id' => $computer->id,
        ]);
    }

    public function migrate(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'hardware_info' => 'required|array',
            'hostname' => 'required|string',
            'agent_version' => 'required|string',
            'wol_mac' => 'nullable|string',
        ]);

        // Validate the legacy credentials
        if (! \Illuminate\Support\Facades\Auth::attempt(['email' => $request->email, 'password' => $request->password])) {
            return response()->json(['message' => 'Invalid legacy credentials'], 401);
        }

        $user = \Illuminate\Support\Facades\Auth::user();
        if (! $user->hasPermissionTo('manage-agents')) {
            return response()->json(['message' => 'User lacks permission to manage agents'], 403);
        }

        // We assume the lab id comes from the previous config script or needs a default.
        // For migration we will assign it to Lab 1 as standard, but we should let the request pass lab_id
        $firstLab = \App\Models\Lab::first();
        $labId = $request->input('lab_id', $firstLab ? $firstLab->id : 1);

        $plainApiKey = \Illuminate\Support\Str::random(60);
        $hashedApiKey = hash('sha256', $plainApiKey);
        $machineId = md5(json_encode($request->hardware_info));

        $computer = \App\Models\Computer::updateOrCreate(
            ['machine_id' => $machineId],
            [
                'lab_id' => $labId,
                'hostname' => $request->hostname,
                'hardware_info' => $request->hardware_info,
                'agent_version' => $request->agent_version,
                'wol_mac' => $request->wol_mac,
                'agent_api_key' => $hashedApiKey,
            ]
        );

        return response()->json([
            'message' => 'Agent migrated successfully',
            'api_key' => $plainApiKey,
            'computer_id' => $computer->id,
        ]);
    }
}
