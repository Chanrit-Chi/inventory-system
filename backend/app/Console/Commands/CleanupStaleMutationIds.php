<?php

namespace App\Console\Commands;

use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Console\Command;

class CleanupStaleMutationIds extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'mutations:cleanup-ttl {--days=30 : Number of days of TTL before client mutation IDs are purged}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up stale client mutation IDs older than the specified TTL to free up unique constraints and prevent table bloat.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = (int) $this->option('days');
        if ($days < 1) {
            $this->error('The --days option must be an integer greater than 0.');
            return 1;
        }

        $cutoff = Carbon::now()->subDays($days);
        $this->info("Purging client mutation IDs older than {$cutoff->toDateTimeString()} ({$days} days TTL)...");

        $affected = Order::whereNotNull('client_mutation_id')
            ->where('created_at', '<', $cutoff)
            ->update(['client_mutation_id' => null]);

        $this->info("Successfully purged {$affected} stale client mutation ID(s).");

        return 0;
    }
}
