<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Services\BarcodeScannerService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BarcodeScannerController extends BaseApiController
{
    public function __construct(
        private readonly BarcodeScannerService $scanner
    ) {}

    /**
     * GET /api/v1/inventory/scan?code={barcode_or_sku}
     */
    public function scan(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'max:200'],
        ]);

        try {
            $result = $this->scanner->scan($request->string('code')->toString());
            return $this->successResponse($result);
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Product not found.', null, 404);
        }
    }
}
