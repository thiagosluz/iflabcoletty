<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use OpenApi\Attributes as OA;

class UserController extends Controller
{
    #[OA\Get(
        path: "/api/v1/users",
        summary: "Listar usuários",
        tags: ["Usuários"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "per_page", in: "query", required: false, schema: new OA\Schema(type: "integer", example: 20)),
            new OA\Parameter(name: "search", in: "query", required: false, schema: new OA\Schema(type: "string")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Lista de usuários"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
        ]
    )]
    public function index(Request $request)
    {
        $this->authorize('users.view');

        $query = User::with('roles:id,name');

        // Search
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Pagination
        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int)$perPage, 5), 100);

        return $query->orderBy('name')->paginate($perPage);
    }

    #[OA\Post(
        path: "/api/v1/users",
        summary: "Criar usuário",
        tags: ["Usuários"],
        security: [["sanctum" => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ["name", "email", "password"],
                properties: [
                    new OA\Property(property: "name", type: "string"),
                    new OA\Property(property: "email", type: "string", format: "email"),
                    new OA\Property(property: "password", type: "string"),
                    new OA\Property(property: "roles", type: "array", items: new OA\Items(type: "string")),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: "Usuário criado"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
            new OA\Response(response: 422, description: "Erro de validação"),
        ]
    )]
    public function store(Request $request)
    {
        $this->authorize('users.create');

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'roles' => 'nullable|array',
            'roles.*' => 'exists:roles,name',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        if (isset($validated['roles'])) {
            $user->syncRoles($validated['roles']);
        }

        $user->load('roles:id,name');

        return response()->json($user, 201);
    }

    #[OA\Get(
        path: "/api/v1/users/{id}",
        summary: "Obter detalhes do usuário",
        tags: ["Usuários"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Detalhes do usuário"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
            new OA\Response(response: 404, description: "Usuário não encontrado"),
        ]
    )]
    public function show(User $user)
    {
        $this->authorize('users.view');

        $user->load('roles:id,name', 'permissions:id,name');

        return response()->json($user);
    }

    #[OA\Put(
        path: "/api/v1/users/{id}",
        summary: "Atualizar usuário",
        tags: ["Usuários"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: "name", type: "string"),
                    new OA\Property(property: "email", type: "string", format: "email"),
                    new OA\Property(property: "password", type: "string"),
                    new OA\Property(property: "roles", type: "array", items: new OA\Items(type: "string")),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: "Usuário atualizado"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
            new OA\Response(response: 404, description: "Usuário não encontrado"),
            new OA\Response(response: 422, description: "Erro de validação"),
        ]
    )]
    public function update(Request $request, User $user)
    {
        $this->authorize('users.update');

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'sometimes|string|min:8',
            'roles' => 'nullable|array',
            'roles.*' => 'exists:roles,name',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        if (isset($validated['roles'])) {
            $user->syncRoles($validated['roles']);
        }

        $user->load('roles:id,name', 'permissions:id,name');

        return response()->json($user);
    }

    #[OA\Delete(
        path: "/api/v1/users/{id}",
        summary: "Excluir usuário",
        tags: ["Usuários"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 204, description: "Usuário excluído"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Sem permissão"),
            new OA\Response(response: 404, description: "Usuário não encontrado"),
        ]
    )]
    public function destroy(User $user)
    {
        $this->authorize('users.delete');

        // Não permitir excluir a si mesmo
        if ($user->id === auth()->id()) {
            return response()->json([
                'message' => 'Você não pode excluir seu próprio usuário'
            ], 403);
        }

        $user->delete();

        return response()->noContent();
    }
}
