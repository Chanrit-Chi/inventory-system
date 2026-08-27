<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\StoreSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class StoreSettingController extends BaseApiController
{
    /**
     * GET /api/v1/settings/branding
     *
     * Returns current store branding configuration.
     */
    public function getBranding(Request $request): JsonResponse
    {
        $setting = StoreSetting::current();

        return $this->successResponse([
            'id'               => $setting->id,
            'store_name'       => $setting->store_name,
            'tagline'          => $setting->tagline,
            'logo_url'         => $setting->logo_url,
            'primary_color'    => $setting->primary_color,
            'store_address'    => $setting->store_address,
            'store_phone'      => $setting->store_phone,
            'receipt_header'   => $setting->receipt_header,
            'invoice_header'   => $setting->invoice_header,
            'quotation_header' => $setting->quotation_header,
            'receipt_footer'   => $setting->receipt_footer,
            'show_tax'         => (bool) ($setting->show_tax ?? false),
            'updated_at'       => $setting->updated_at?->toIso8601String(),
        ], 'Store branding retrieved successfully');
    }

    /**
     * POST /api/v1/settings/branding
     *
     * Updates store branding configuration.
     */
    public function updateBranding(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store_name'       => 'nullable|string|max:100',
            'tagline'          => 'nullable|string|max:150',
            'logo'             => 'nullable|file|mimes:jpeg,png,jpg,webp,svg|max:5120',
            'logo_url'         => 'nullable|string',
            'remove_logo'      => 'nullable|boolean',
            'primary_color'    => 'nullable|string|max:30',
            'store_address'    => 'nullable|string|max:255',
            'store_phone'      => 'nullable|string|max:50',
            'receipt_header'   => 'nullable|string|max:100',
            'invoice_header'   => 'nullable|string|max:100',
            'quotation_header' => 'nullable|string|max:100',
            'receipt_footer'   => 'nullable|string|max:500',
            'show_tax'         => 'nullable|boolean',
        ]);

        $setting = StoreSetting::current();

        if ($request->has('store_name') && $validated['store_name'] !== null) {
            $setting->store_name = $validated['store_name'];
        }

        if ($request->has('tagline')) {
            $setting->tagline = $validated['tagline'];
        }

        if ($request->has('primary_color') && $validated['primary_color']) {
            $setting->primary_color = $validated['primary_color'];
        }

        if ($request->has('store_address')) {
            $setting->store_address = $validated['store_address'];
        }

        if ($request->has('store_phone')) {
            $setting->store_phone = $validated['store_phone'];
        }

        if ($request->has('receipt_header')) {
            $setting->receipt_header = $validated['receipt_header'];
        }

        if ($request->has('invoice_header')) {
            $setting->invoice_header = $validated['invoice_header'];
        }

        if ($request->has('quotation_header')) {
            $setting->quotation_header = $validated['quotation_header'];
        }

        if ($request->has('receipt_footer')) {
            $setting->receipt_footer = $validated['receipt_footer'];
        }

        if ($request->has('show_tax')) {
            $setting->show_tax = $request->boolean('show_tax');
        }

        // Handle Logo file upload
        if ($request->hasFile('logo')) {
            $file = $request->file('logo');
            $path = $file->store('branding', 'public');
            $setting->logo_url = Storage::disk('public')->url($path);
        } elseif ($request->boolean('remove_logo')) {
            $setting->logo_url = null;
        } elseif ($request->filled('logo_url')) {
            $setting->logo_url = $request->input('logo_url');
        }

        $setting->save();

        return $this->successResponse([
            'id'               => $setting->id,
            'store_name'       => $setting->store_name,
            'tagline'          => $setting->tagline,
            'logo_url'         => $setting->logo_url,
            'primary_color'    => $setting->primary_color,
            'store_address'    => $setting->store_address,
            'store_phone'      => $setting->store_phone,
            'receipt_header'   => $setting->receipt_header,
            'invoice_header'   => $setting->invoice_header,
            'quotation_header' => $setting->quotation_header,
            'receipt_footer'   => $setting->receipt_footer,
            'show_tax'         => (bool) ($setting->show_tax ?? false),
            'updated_at'       => $setting->updated_at?->toIso8601String(),
        ], 'Store branding updated successfully');
    }
}
