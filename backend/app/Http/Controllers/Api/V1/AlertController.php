<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\AlertRule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AlertController extends Controller
{
    // --- Alerts ---

    public function index(Request $request)
    {
        $query = Alert::with(['computer', 'rule']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        
        if ($request->has('severity')) {
            $query->where('severity', $request->severity);
        }

        if ($request->has('computer_id')) {
            $query->where('computer_id', $request->computer_id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->paginate(20));
    }

    public function show(Alert $alert)
    {
        return response()->json($alert->load(['computer', 'rule']));
    }

    public function resolve(Alert $alert)
    {
        $alert->update([
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);

        return response()->json($alert);
    }
    
    public function stats()
    {
        return response()->json([
            'total_active' => Alert::active()->count(),
            'by_severity' => Alert::active()->selectRaw('severity, count(*) as count')
                ->groupBy('severity')->pluck('count', 'severity'),
            'recent' => Alert::with('computer')->orderBy('created_at', 'desc')->limit(5)->get()
        ]);
    }

    // --- Rules ---

    public function rulesIndex(Request $request)
    {
        return response()->json(AlertRule::with('lab')->paginate(20));
    }

    public function rulesStore(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:metric,status,software',
            'metric' => 'nullable|string',
            'condition' => 'nullable|string',
            'threshold' => 'nullable|numeric',
            'duration_minutes' => 'integer',
            'severity' => 'required|string|in:info,warning,critical',
            'lab_id' => 'nullable|exists:labs,id',
            'notification_channels' => 'array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $rule = AlertRule::create($request->all());

        return response()->json($rule, 201);
    }

    public function rulesUpdate(Request $request, AlertRule $rule)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'string|max:255',
            'type' => 'string|in:metric,status,software',
            'severity' => 'string|in:info,warning,critical',
            'lab_id' => 'nullable|exists:labs,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $rule->update($request->all());

        return response()->json($rule);
    }

    public function rulesDestroy(AlertRule $rule)
    {
        $rule->delete();
        return response()->json(null, 204);
    }
}
