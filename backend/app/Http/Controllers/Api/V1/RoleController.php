<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use OpenApi\Attributes as OA;

class RoleController extends Controller
{
    #[OA\Get(
        path: "/api/v1/roles",
        summary: "Listar roles",
        tags: ["Roles"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(response: 200, description: "Lista de roles"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
        ]
    )]
    public function index()
    {
        $this->authorize('roles.view');

        $roles = Role::with('permissions:id,name')->get();

        return response()->json($roles);
    }

    #[OA\Get(
        path: "/api/v1/permissions",
        summary: "Listar permissions",
        tags: ["Roles"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(response: 200, description: "Lista de permissions"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
        ]
    )]
    public function permissions()
    {
        $this->authorize('roles.view');

        $permissions = Permission::all();

        return response()->json($permissions);
    }

    #[OA\Post(
        path: "/api/v1/roles",
        summary: "Criar role",
        tags: ["Roles"],
        security: [["sanctum" => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ["name"],
                properties: [
                    new OA\Property(property: "name", type: "string"),
                    new OA\Property(property: "permissions", type: "array", items: new OA\Items(type: "string")),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: "Role criada"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
            new OA\Response(response: 422, description: "Erro de validação"),
        ]
    )]
    public function store(Request $request)
    {
        $this->authorize('roles.create');

        $validated = $request->validate([
            'name' => 'required|string|unique:roles,name|max:255',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        $role = Role::create(['name' => $validated['name']]);

        if (isset($validated['permissions'])) {
            $role->givePermissionTo($validated['permissions']);
        }

        $role->load('permissions:id,name');

        return response()->json($role, 201);
    }

    #[OA\Get(
        path: "/api/v1/roles/{id}",
        summary: "Obter detalhes da role",
        tags: ["Roles"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Detalhes da role"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
            new OA\Response(response: 404, description: "Role não encontrada"),
        ]
    )]
    public function show(Role $role)
    {
        $this->authorize('roles.view');

        $role->load('permissions:id,name');

        return response()->json($role);
    }

    #[OA\Put(
        path: "/api/v1/roles/{id}",
        summary: "Atualizar role",
        tags: ["Roles"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: "name", type: "string"),
                    new OA\Property(property: "permissions", type: "array", items: new OA\Items(type: "string")),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: "Role atualizada"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
            new OA\Response(response: 404, description: "Role não encontrada"),
            new OA\Response(response: 422, description: "Erro de validação"),
        ]
    )]
    public function update(Request $request, Role $role)
    {
        $this->authorize('roles.update');

        // Não permitir alterar roles do sistema (admin)
        if (in_array($role->name, ['admin']) && $request->has('permissions')) {
            return response()->json([
                'message' => 'Não é permitido alterar permissões da role admin'
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', \Illuminate\Validation\Rule::unique('roles')->ignore($role->id)],
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        if (isset($validated['name'])) {
            $role->update(['name' => $validated['name']]);
        }

        if (isset($validated['permissions'])) {
            $role->syncPermissions($validated['permissions']);
        }

        $role->load('permissions:id,name');

        return response()->json($role);
    }

    #[OA\Delete(
        path: "/api/v1/roles/{id}",
        summary: "Excluir role",
        tags: ["Roles"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 204, description: "Role excluída"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
            new OA\Response(response: 404, description: "Role não encontrada"),
        ]
    )]
    public function destroy(Role $role)
    {
        $this->authorize('roles.delete');

        // Não permitir excluir roles do sistema
        if (in_array($role->name, ['admin', 'technician', 'professor', 'viewer'])) {
            return response()->json([
                'message' => 'Não é permitido excluir roles do sistema'
            ], 403);
        }

        $role->delete();

        return response()->noContent();
    }
}
