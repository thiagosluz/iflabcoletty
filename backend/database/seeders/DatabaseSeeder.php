<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Lab;
use App\Models\Computer;
use App\Models\Software;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Criar roles e permissions primeiro
        $this->call(RolePermissionSeeder::class);

        // Criar usuário admin (se não existir)
        $admin = User::firstOrCreate(
            ['email' => 'admin@iflab.com'],
            [
                'name' => 'Admin User',
                'password' => bcrypt('password'),
                'email_verified_at' => now(),
            ]
        );

        // Garantir que o admin tenha a role admin
        if (!$admin->hasRole('admin')) {
            $admin->assignRole('admin');
        }

        if ($admin->wasRecentlyCreated) {
            $this->command->info('Usuário admin criado: admin@iflab.com / password');
        } else {
            $this->command->info('Usuário admin já existe: admin@iflab.com');
        }

        // Criar laboratórios
        $labs = $this->createLabs();
        $this->command->info('Laboratórios criados: ' . $labs->count());

        // Criar softwares comuns
        $softwares = $this->createSoftwares();
        $this->command->info('Softwares criados: ' . $softwares->count());

        // Criar computadores para cada laboratório
        $totalComputers = 0;
        foreach ($labs as $lab) {
            $computers = $this->createComputersForLab($lab, $softwares);
            $totalComputers += $computers->count();
        }
        $this->command->info('Computadores criados: ' . $totalComputers);
    }

    /**
     * Criar laboratórios de teste
     */
    private function createLabs()
    {
        $labsData = [
            [
                'name' => 'Laboratório de Informática 1',
                'description' => 'Laboratório principal para aulas de programação e desenvolvimento',
            ],
            [
                'name' => 'Laboratório de Informática 2',
                'description' => 'Laboratório secundário para aulas práticas',
            ],
            [
                'name' => 'Laboratório de Redes',
                'description' => 'Laboratório especializado em redes de computadores e segurança',
            ],
            [
                'name' => 'Laboratório de Hardware',
                'description' => 'Laboratório para manutenção e montagem de computadores',
            ],
            [
                'name' => 'Laboratório de Multimídia',
                'description' => 'Laboratório com equipamentos para produção de conteúdo multimídia',
            ],
        ];

        $labs = collect();
        foreach ($labsData as $labData) {
            $labs->push(Lab::firstOrCreate(
                ['name' => $labData['name']],
                $labData
            ));
        }

        return $labs;
    }

    /**
     * Criar softwares comuns de laboratórios
     */
    private function createSoftwares()
    {
        $softwaresData = [
            // Editores de código
            ['name' => 'Visual Studio Code', 'version' => '1.85.0', 'vendor' => 'Microsoft'],
            ['name' => 'IntelliJ IDEA', 'version' => '2023.3', 'vendor' => 'JetBrains'],
            ['name' => 'Eclipse IDE', 'version' => '2023-12', 'vendor' => 'Eclipse Foundation'],
            ['name' => 'NetBeans', 'version' => '20', 'vendor' => 'Apache'],
            
            // Compiladores e Runtimes
            ['name' => 'Java JDK', 'version' => '21.0.1', 'vendor' => 'Oracle'],
            ['name' => 'Python', 'version' => '3.12.0', 'vendor' => 'Python Software Foundation'],
            ['name' => 'Node.js', 'version' => '20.10.0', 'vendor' => 'Node.js Foundation'],
            ['name' => 'GCC', 'version' => '13.2.0', 'vendor' => 'GNU'],
            
            // Bancos de dados
            ['name' => 'MySQL', 'version' => '8.0.35', 'vendor' => 'Oracle'],
            ['name' => 'PostgreSQL', 'version' => '16.1', 'vendor' => 'PostgreSQL Global Development Group'],
            ['name' => 'MongoDB', 'version' => '7.0.4', 'vendor' => 'MongoDB Inc.'],
            ['name' => 'SQLite', 'version' => '3.44.0', 'vendor' => 'SQLite Development Team'],
            
            // Ferramentas de desenvolvimento
            ['name' => 'Git', 'version' => '2.43.0', 'vendor' => 'Git'],
            ['name' => 'Docker Desktop', 'version' => '4.25.0', 'vendor' => 'Docker Inc.'],
            ['name' => 'Postman', 'version' => '10.21.0', 'vendor' => 'Postman'],
            ['name' => 'Wireshark', 'version' => '4.2.0', 'vendor' => 'Wireshark Foundation'],
            
            // Office
            ['name' => 'Microsoft Office', 'version' => '2021', 'vendor' => 'Microsoft'],
            ['name' => 'LibreOffice', 'version' => '7.6.0', 'vendor' => 'The Document Foundation'],
            
            // Navegadores
            ['name' => 'Google Chrome', 'version' => '120.0.6099.109', 'vendor' => 'Google'],
            ['name' => 'Mozilla Firefox', 'version' => '121.0', 'vendor' => 'Mozilla'],
            ['name' => 'Microsoft Edge', 'version' => '120.0.2210.91', 'vendor' => 'Microsoft'],
            
            // Design e Multimídia
            ['name' => 'GIMP', 'version' => '2.10.36', 'vendor' => 'GIMP Team'],
            ['name' => 'Inkscape', 'version' => '1.3.2', 'vendor' => 'Inkscape'],
            ['name' => 'Blender', 'version' => '4.0.2', 'vendor' => 'Blender Foundation'],
            ['name' => 'Audacity', 'version' => '3.4.2', 'vendor' => 'Audacity Team'],
            
            // Virtualização
            ['name' => 'VirtualBox', 'version' => '7.0.12', 'vendor' => 'Oracle'],
            ['name' => 'VMware Workstation', 'version' => '17.5.0', 'vendor' => 'VMware'],
            
            // Segurança
            ['name' => 'Nmap', 'version' => '7.95', 'vendor' => 'Nmap Project'],
            ['name' => 'Metasploit', 'version' => '6.3.0', 'vendor' => 'Rapid7'],
        ];

        $softwares = collect();
        foreach ($softwaresData as $softwareData) {
            $softwares->push(Software::firstOrCreate(
                ['name' => $softwareData['name'], 'version' => $softwareData['version']],
                $softwareData
            ));
        }

        return $softwares;
    }

    /**
     * Criar computadores para um laboratório
     */
    private function createComputersForLab(Lab $lab, $softwares)
    {
        $computerCount = match($lab->name) {
            'Laboratório de Informática 1' => 25,
            'Laboratório de Informática 2' => 20,
            'Laboratório de Redes' => 15,
            'Laboratório de Hardware' => 10,
            'Laboratório de Multimídia' => 12,
            default => 15,
        };

        $computers = collect();
        $osOptions = [
            ['system' => 'Linux', 'release' => 'Ubuntu 22.04'],
            ['system' => 'Linux', 'release' => 'Ubuntu 20.04'],
            ['system' => 'Windows', 'release' => '11'],
            ['system' => 'Windows', 'release' => '10'],
        ];

        for ($i = 1; $i <= $computerCount; $i++) {
            $os = fake()->randomElement($osOptions);
            
            $hostname = strtolower(str_replace(' ', '-', $lab->name)) . '-pc' . str_pad($i, 2, '0', STR_PAD_LEFT);
            $machineId = Str::uuid()->toString();
            
            // Calcular valores do disco antes de criar
            $diskTotal = fake()->randomElement([256, 512, 1000, 2000]);
            $diskUsed = fake()->randomFloat(2, $diskTotal * 0.2, $diskTotal * 0.8);
            $diskFree = round($diskTotal - $diskUsed, 2);
            
            $computer = Computer::firstOrCreate(
                ['machine_id' => $machineId],
                [
                    'lab_id' => $lab->id,
                    'hostname' => $hostname,
                    'public_hash' => bin2hex(random_bytes(32)),
                    'hardware_info' => [
                        'cpu' => [
                            'physical_cores' => fake()->randomElement([4, 6, 8, 12]),
                            'logical_cores' => fake()->randomElement([8, 12, 16, 24]),
                            'model' => fake()->randomElement([
                                'Intel Core i5-12400',
                                'Intel Core i7-12700',
                                'AMD Ryzen 5 5600X',
                                'AMD Ryzen 7 5800X',
                            ]),
                        ],
                        'memory' => [
                            'total_gb' => fake()->randomElement([8, 16, 32]),
                        ],
                        'disk' => [
                            'total_gb' => $diskTotal,
                            'used_gb' => $diskUsed,
                            'free_gb' => $diskFree,
                        ],
                        'os' => $os,
                    ],
                    'updated_at' => fake()->boolean(70) ? now() : now()->subHours(fake()->numberBetween(1, 24)),
                ]
            );

            // Instalar softwares aleatórios (3 a 8 softwares por computador) apenas se não tiver softwares
            if ($computer->softwares()->count() === 0) {
                $installedSoftwares = $softwares->random(fake()->numberBetween(3, 8));
                $computer->softwares()->attach(
                    $installedSoftwares->pluck('id')->toArray(),
                    ['installed_at' => now()->subDays(fake()->numberBetween(1, 90))]
                );
            }

            $computers->push($computer);
        }

        return $computers;
    }
}
