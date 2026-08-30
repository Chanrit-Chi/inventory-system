<?php

namespace App\Console\Commands;

use App\Services\AuditLogService;
use Illuminate\Console\Command;

class AuditLogBackfill extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'audit-log:backfill {--chunk=100 : Chunk size for processing records}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Backfill audit_logs table from existing source models (StockMovement, PersonalAccessToken, Order, Invoice, User, PayrollAuditLog).';

    /**
     * Execute the console command.
     */
    public function handle(AuditLogService $auditLogService): int
    {
        $chunkSize = (int) $this->option('chunk');
        if ($chunkSize < 1) {
            $this->error('The --chunk option must be an integer greater than 0.');
            return 1;
        }

        $this->info("Starting audit log backfill with chunk size {$chunkSize}...");

        try {
            $counts = $auditLogService->bulkSync();

            $this->info('Backfill completed successfully!');
            $this->table(
                ['Source', 'Records Synced'],
                [
                    ['Stock Movements', $counts['stock_movements']],
                    ['Personal Access Tokens (Logins)', $counts['tokens']],
                    ['Orders', $counts['orders']],
                    ['Invoices', $counts['invoices']],
                    ['Users', $counts['users']],
                    ['Payroll Audit Logs', $counts['payroll']],
                    ['TOTAL', array_sum($counts)],
                ]
            );

            return 0;
        } catch (\Throwable $e) {
            $this->error('Backfill failed: ' . $e->getMessage());
            $this->error($e->getTraceAsString());
            return 1;
        }
    }
}