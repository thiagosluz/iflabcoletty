<?php

namespace App;

use OpenApi\Attributes as OA;

#[OA\Info(
    version: '1.0.0',
    title: 'IFG Lab Manager API',
    description: 'API RESTful para gerenciamento de laboratórios de informática do IFG'
)]
#[OA\Server(
    url: '/api/v1',
    description: 'Servidor de API'
)]
#[OA\SecurityScheme(
    securityScheme: 'sanctum',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Autenticação via Laravel Sanctum'
)]
class OpenApiInfo {}
