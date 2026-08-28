<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\SalesChannel;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CleanupStaleMutationIdsTest extends TestCase
{
    use RefreshDatabase;

    public function test_cleanup_stale_mutation_ids_purges_older_records(): void
    {
        $channel = SalesChannel::firstOrCreate(
            ['name' => 'POS Main'],
            ['platform' => 'POS', 'is_default' => true]
        );

        // 1. Order created 40 days ago with mutation ID
        $oldOrder = Order::create([
            'order_number'        => 'ORD-OLD-001',
            'client_mutation_id'  => 'MUT-STALE-OLD-001',
            'channel_id'          => $channel->id,
            'status'              => 'completed',
            'payment_status'      => 'PAID',
            'subtotal'            => 50.00,
            'total_amount'        => 50.00,
        ]);
        $oldOrder->created_at = Carbon::now()->subDays(40);
        $oldOrder->save(['timestamps' => false]);

        // 2. Fresh order created 2 days ago with mutation ID
        $freshOrder = Order::create([
            'order_number'        => 'ORD-FRESH-002',
            'client_mutation_id'  => 'MUT-FRESH-RECENT-002',
            'channel_id'          => $channel->id,
            'status'              => 'completed',
            'payment_status'      => 'PAID',
            'subtotal'            => 25.00,
            'total_amount'        => 25.00,
        ]);
        $freshOrder->created_at = Carbon::now()->subDays(2);
        $freshOrder->save(['timestamps' => false]);

        // Run the artisan command with 30 days TTL
        $exitCode = Artisan::call('mutations:cleanup-ttl', ['--days' => 30]);
        $this->assertEquals(0, $exitCode);

        $oldOrder->refresh();
        $freshOrder->refresh();

        // Old order mutation ID must be cleared
        $this->assertNull($oldOrder->client_mutation_id);
        // Fresh order mutation ID must remain intact
        $this->assertEquals('MUT-FRESH-RECENT-002', $freshOrder->client_mutation_id);
    }
}
