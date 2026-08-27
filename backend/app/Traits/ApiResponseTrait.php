<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;

trait ApiResponseTrait
{
    /**
     * Return a standardized success JSON response.
     */
    public function successResponse(mixed $data = null, ?string $message = null, int $status = 200, ?array $meta = null): JsonResponse
    {
        $payload = [
            'success' => true,
        ];

        if ($data !== null) {
            $payload['data'] = $data;
        }

        if ($message !== null) {
            $payload['message'] = $message;
        }

        if ($meta !== null) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    /**
     * Return a standardized created resource response (201 Created).
     */
    public function createdResponse(mixed $data = null, ?string $message = 'Resource created successfully.'): JsonResponse
    {
        return $this->successResponse($data, $message, 201);
    }

    /**
     * Return a standardized paginated JSON response.
     */
    public function paginatedResponse(LengthAwarePaginator $paginator, ?string $message = null): JsonResponse
    {
        $payload = [
            'success' => true,
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];

        if ($message !== null) {
            $payload['message'] = $message;
        }

        return response()->json($payload, 200);
    }

    /**
     * Return a standardized error JSON response.
     */
    public function errorResponse(string $message, mixed $errors = null, int $status = 400): JsonResponse
    {
        $payload = [
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ];

        return response()->json($payload, $status);
    }
}
