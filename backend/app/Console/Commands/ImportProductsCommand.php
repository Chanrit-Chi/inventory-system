<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ImportService;
use Illuminate\Console\Command;

class ImportProductsCommand extends Command
{
    protected $signature = 'products:import 
                            {file : Path to the spreadsheet (.xlsx, .xls, .csv)} 
                            {--update-existing : Update existing products matching by SKU, barcode, or name}';

    protected $description = 'Import or update products from spreadsheet with automatic image downloading (AppSheet, Google Drive, URLs)';

    public function handle(ImportService $importService): int
    {
        $filePath = $this->argument('file');

        if (!file_exists($filePath)) {
            $this->error("File not found: {$filePath}");
            return 1;
        }

        $updateExisting = (bool) $this->option('update_existing');

        // Find an admin or first active user as the actor
        $actor = User::where('role', 'ADMIN')->first() 
              ?? User::where('is_active', true)->first()
              ?? User::first();

        if (!$actor) {
            $this->error("No active user found in the system to attribute import to.");
            return 1;
        }

        $this->info("Starting product import from: {$filePath}");
        $this->line("Mode: " . ($updateExisting ? "Update existing + insert new" : "Insert new only"));
        $this->line("Actor: {$actor->name} ({$actor->email})");

        // Allow plenty of execution time for downloading multiple images
        set_time_limit(600);

        $result = $importService->importProducts($filePath, $actor, $updateExisting);

        $this->newLine();
        $this->info("Import completed successfully!");
        $this->table(
            ['Imported (New)', 'Updated', 'Skipped', 'Errors Count'],
            [[$result['imported'], $result['updated'], $result['skipped'], count($result['errors'])]]
        );

        if (!empty($result['errors'])) {
            $this->newLine();
            $this->warn("Warnings / Errors encountered during import:");
            $errorRows = array_map(fn($err) => [$err['row'] ?? '-', $err['message'] ?? 'Unknown error'], array_slice($result['errors'], 0, 25));
            $this->table(['Row', 'Message'], $errorRows);

            if (count($result['errors']) > 25) {
                $this->line("... and " . (count($result['errors']) - 25) . " more error(s).");
            }
        }

        return 0;
    }
}
