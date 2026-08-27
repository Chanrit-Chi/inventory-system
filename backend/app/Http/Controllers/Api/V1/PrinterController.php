<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrinterController extends Controller
{
    public function rawPrint(Request $request): JsonResponse
    {
        $request->validate([
            'ip'       => 'required|string',
            'port'     => 'nullable|integer',
            'data'     => 'required|string',
            'encoding' => 'nullable|string|in:base64,raw',
        ]);

        $ip   = $request->input('ip');
        $port = (int) ($request->input('port') ?: 9100);
        $raw  = $request->input('data');

        // Decode Base64 so ESC/POS control bytes (0x1B, 0x1D, etc.) arrive intact.
        // The mobile client always sends encoding=base64.
        if ($request->input('encoding') === 'base64') {
            $raw = base64_decode($raw);
            if ($raw === false) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid base64 data payload.',
                ], 422);
            }
        }

        $fp = @fsockopen($ip, $port, $errno, $errstr, 2.0);

        if (!$fp) {
            return response()->json([
                'success' => false,
                'message' => "Could not connect to printer at {$ip}:{$port}. Error {$errno}: {$errstr}",
            ], 422);
        }

        fwrite($fp, $raw);
        fflush($fp);
        fclose($fp);

        return response()->json([
            'success' => true,
            'message' => "Receipt sent to printer at {$ip}:{$port}",
        ]);
    }
}
