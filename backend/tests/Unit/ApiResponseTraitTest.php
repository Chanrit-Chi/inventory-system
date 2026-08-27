<?php

namespace Tests\Unit;

use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Tests\TestCase;

class ApiResponseTraitTest extends TestCase
{
    private object $traitConsumer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->traitConsumer = new class {
            use ApiResponseTrait;
        };
    }

    /**
     * Test successResponse formatting.
     */
    public function test_success_response(): void
    {
        $response = $this->traitConsumer->successResponse(['key' => 'value'], 'Success message');

        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertEquals(200, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertTrue($data['success']);
        $this->assertEquals('Success message', $data['message']);
        $this->assertEquals('value', $data['data']['key']);
    }

    /**
     * Test createdResponse formatting.
     */
    public function test_created_response(): void
    {
        $response = $this->traitConsumer->createdResponse(['id' => '123'], 'Created entity');

        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertEquals(201, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertTrue($data['success']);
        $this->assertEquals('Created entity', $data['message']);
        $this->assertEquals('123', $data['data']['id']);
    }

    /**
     * Test paginatedResponse formatting.
     */
    public function test_paginated_response(): void
    {
        $items = collect([['id' => 1], ['id' => 2]]);
        $paginator = new LengthAwarePaginator($items, 10, 2, 1);

        $response = $this->traitConsumer->paginatedResponse($paginator, 'Page fetched');

        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertEquals(200, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertTrue($data['success']);
        $this->assertCount(2, $data['data']);
        $this->assertEquals(1, $data['meta']['current_page']);
        $this->assertEquals(2, $data['meta']['per_page']);
        $this->assertEquals(10, $data['meta']['total']);
        $this->assertEquals(5, $data['meta']['last_page']);
    }

    /**
     * Test errorResponse formatting.
     */
    public function test_error_response(): void
    {
        $response = $this->traitConsumer->errorResponse('Validation failed', ['field' => ['Required']], 422);

        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertEquals(422, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertFalse($data['success']);
        $this->assertEquals('Validation failed', $data['message']);
        $this->assertEquals(['Required'], $data['errors']['field']);
    }
}
