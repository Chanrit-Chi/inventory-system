<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use DatabaseMigrations;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name'             => 'Audit Admin',
            'email'            => 'audit-admin@pos.test',
            'password'         => \Illuminate\Support\Facades\Hash::make('Secret123!'),
            'role'             => 'ADMIN',
            'is_active'        => true,
            'permission_group' => 'BranchManagement',
        ]);

        AuditLog::create([
            'source_type' => 'PERSONAL_ACCESS_TOKEN',
            'source_id' => 'pat-1',
            'action' => 'USER_LOGIN',
            'category' => 'SECURITY',
            'target' => 'Admin Panel',
            'actor_name' => 'Admin User',
            'actor_role' => 'admin',
            'details' => 'Logged in from web',
            'occurred_at' => '2026-08-20 10:00:00',
        ]);

        AuditLog::create([
            'source_type' => 'STOCK_MOVEMENT',
            'source_id' => 'sm-1',
            'action' => 'RESTOCK',
            'category' => 'INVENTORY',
            'target' => 'Thai Tea Powder',
            'actor_name' => 'Warehouse Lead',
            'actor_role' => 'manager',
            'details' => 'Added 50 bags',
            'occurred_at' => '2026-08-25 14:00:00',
        ]);

        AuditLog::create([
            'source_type' => 'ORDER',
            'source_id' => 'ord-1001',
            'action' => 'ORDER_CREATED',
            'category' => 'ORDERS',
            'target' => 'ORD-1001',
            'actor_name' => 'Cashier Amy',
            'actor_role' => 'cashier',
            'details' => 'Walk-in customer order',
            'occurred_at' => '2026-08-28 09:30:00',
        ]);
    }

    public function test_audit_logs_index_returns_paginated_list(): void
    {
        $response = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs');

        $response->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);

        $this->assertGreaterThanOrEqual(3, count($response->json('data')));
    }

    public function test_audit_logs_can_filter_by_canonical_and_aliased_category(): void
    {
        // Canonical SECURITY
        $secRes = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs?category=SECURITY');
        $secRes->assertOk();
        $this->assertCount(1, $secRes->json('data'));
        $this->assertEquals('SECURITY', $secRes->json('data.0.category'));

        // Alias AUTH
        $authRes = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs?category=AUTH');
        $authRes->assertOk();
        $this->assertCount(1, $authRes->json('data'));

        // Canonical INVENTORY
        $invRes = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs?category=INVENTORY');
        $invRes->assertOk();
        $this->assertCount(1, $invRes->json('data'));
        $this->assertEquals('INVENTORY', $invRes->json('data.0.category'));

        // Alias PRODUCTS
        $prodRes = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs?category=PRODUCTS');
        $prodRes->assertOk();
        $this->assertCount(1, $prodRes->json('data'));

        // ORDERS
        $orderRes = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs?category=ORDERS');
        $orderRes->assertOk();
        $this->assertCount(1, $orderRes->json('data'));
        $this->assertEquals('ORDERS', $orderRes->json('data.0.category'));
    }

    public function test_audit_logs_can_filter_by_date_range(): void
    {
        // Out of bounds (recent date)
        $emptyRes = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs?date_from=2026-09-01&date_to=2026-09-02');
        $emptyRes->assertOk();
        $this->assertCount(0, $emptyRes->json('data'));

        // Window covering the inventory event only
        $windowRes = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs?date_from=2026-08-24&date_to=2026-08-26');
        $windowRes->assertOk();
        $this->assertCount(1, $windowRes->json('data'));
        $this->assertEquals('RESTOCK', $windowRes->json('data.0.action'));
    }

    public function test_audit_logs_can_search_by_text(): void
    {
        $searchRes = $this->actingAs($this->admin)
            ->getJson('/api/v1/audit-logs?search=Tea');
        $searchRes->assertOk();
        $this->assertCount(1, $searchRes->json('data'));
        $this->assertEquals('Thai Tea Powder', $searchRes->json('data.0.target'));
    }
}
