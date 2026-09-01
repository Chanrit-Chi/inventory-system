<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Http\Requests\Api\V1\ImportRequest;
use App\Services\ImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx as XlsxWriter;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Font;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends BaseApiController
{
    public function __construct(
        private readonly ImportService $importService
    ) {}

    /**
     * POST /api/v1/import/products
     * Upload and process a products XLSX/CSV file.
     */
    public function products(ImportRequest $request): JsonResponse
    {
        $file           = $request->file('file');
        $updateExisting = (bool) $request->input('update_existing', false);
        $actor          = $request->user();

        set_time_limit(180);

        $result = $this->importService->importProducts($file, $actor, $updateExisting);

        $message = "Import complete. {$result['imported']} imported, {$result['updated']} updated, {$result['skipped']} skipped.";

        return $this->successResponse($result, $message);
    }

    /**
     * POST /api/v1/import/sales
     * Upload and process a sales orders XLSX/CSV file.
     */
    public function sales(ImportRequest $request): JsonResponse
    {
        $file  = $request->file('file');
        $actor = $request->user();

        set_time_limit(180);

        $result = $this->importService->importSales($file, $actor);

        $message = "Import complete. {$result['imported']} orders imported, {$result['skipped']} skipped.";

        return $this->successResponse($result, $message);
    }

    /**
     * GET /api/v1/import/template/products
     * Download the products import template as XLSX.
     */
    public function productsTemplate(Request $request): StreamedResponse
    {
        ['headers' => $headers, 'sample' => $sample] = $this->importService->getProductsTemplateData();
        return $this->buildTemplateResponse('products_import_template', $headers, $sample);
    }

    /**
     * GET /api/v1/import/template/sales
     * Download the sales import template as XLSX.
     */
    public function salesTemplate(Request $request): StreamedResponse
    {
        ['headers' => $headers, 'sample' => $sample] = $this->importService->getSalesTemplateData();
        return $this->buildTemplateResponse('sales_import_template', $headers, $sample);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function buildTemplateResponse(string $filename, array $headers, array $sampleRow): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet       = $spreadsheet->getActiveSheet();

        // Write header row
        foreach ($headers as $colIdx => $header) {
            $sheet->setCellValue([$colIdx + 1, 1], strtoupper($header));
        }

        // Style header row
        $lastCol = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($headers));
        $headerRange = "A1:{$lastCol}1";
        $sheet->getStyle($headerRange)->applyFromArray([
            'font' => [
                'bold'  => true,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType'   => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '3B82F6'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
            ],
        ]);

        // Write sample row
        foreach ($sampleRow as $colIdx => $value) {
            $sheet->setCellValue([$colIdx + 1, 2], $value);
        }

        // Style sample row
        $sampleRange = "A2:{$lastCol}2";
        $sheet->getStyle($sampleRange)->applyFromArray([
            'fill' => [
                'fillType'   => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'EFF6FF'],
            ],
        ]);

        // Auto-size columns
        foreach (range(1, count($headers)) as $col) {
            $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col);
            $sheet->getColumnDimension($colLetter)->setAutoSize(true);
        }

        $writer = new XlsxWriter($spreadsheet);

        return response()->stream(
            function () use ($writer) {
                $writer->save('php://output');
            },
            200,
            [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => "attachment; filename=\"{$filename}.xlsx\"",
                'Cache-Control'       => 'max-age=0',
            ]
        );
    }
}
