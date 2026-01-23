<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use OpenApi\Attributes as OA;

class AuthController extends Controller
{
    #[OA\Post(
        path: "/api/v1/login",
        summary: "Autenticar usuário",
        tags: ["Autenticação"],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ["email", "password"],
                properties: [
                    new OA\Property(property: "email", type: "string", format: "email", example: "admin@example.com"),
                    new OA\Property(property: "password", type: "string", format: "password", example: "password"),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: "Login realizado com sucesso",
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: "user", type: "object"),
                        new OA\Property(property: "token", type: "string", example: "1|xxxxxxxxxxxx"),
                    ]
                )
            ),
            new OA\Response(response: 401, description: "Credenciais inválidas"),
            new OA\Response(response: 422, description: "Erro de validação"),
        ]
    )]
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (Auth::attempt($credentials)) {
            $user = Auth::user();
            /** @var \App\Models\User $user */
            $token = $user->createToken('admin-token')->plainTextToken;

            return response()->json([
                'user' => $user,
                'token' => $token
            ]);
        }

        return response()->json([
            'message' => 'As credenciais fornecidas não correspondem aos nossos registros.',
        ], 401);
    }

    #[OA\Post(
        path: "/api/v1/logout",
        summary: "Fazer logout",
        tags: ["Autenticação"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: "Logout realizado com sucesso",
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: "message", type: "string", example: "Logout realizado com sucesso"),
                    ]
                )
            ),
            new OA\Response(response: 401, description: "Não autenticado"),
        ]
    )]
    public function logout(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $user->tokens()->delete();

        return response()->json(['message' => 'Logout realizado com sucesso']);
    }

    #[OA\Get(
        path: "/api/v1/me",
        summary: "Obter informações do usuário autenticado",
        tags: ["Autenticação"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: "Informações do usuário",
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: "id", type: "integer", example: 1),
                        new OA\Property(property: "name", type: "string", example: "Admin"),
                        new OA\Property(property: "email", type: "string", example: "admin@example.com"),
                    ]
                )
            ),
            new OA\Response(response: 401, description: "Não autenticado"),
        ]
    )]
    public function me(Request $request)
    {
        return response()->json($request->user());
    }
}
