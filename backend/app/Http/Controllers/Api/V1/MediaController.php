<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaController extends BaseApiController
{
    /**
     * POST /api/v1/media/upload
     * Upload an image to Cloudflare R2 (or public storage fallback).
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|file|image|mimes:jpeg,png,jpg,webp,gif|max:10240', // 10MB max
            'folder' => 'nullable|string|max:50',
        ]);

        $file = $request->file('image');
        $folder = $request->input('folder', 'products');

        // Check if Supabase or Cloudflare R2 credentials are configured
        $useSupabase = !empty(config('filesystems.disks.supabase.key'))
            && !empty(config('filesystems.disks.supabase.secret'))
            && !empty(config('filesystems.disks.supabase.bucket'));

        $useR2 = !empty(config('filesystems.disks.r2.key'))
            && !empty(config('filesystems.disks.r2.secret'))
            && !empty(config('filesystems.disks.r2.bucket'));

        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = Str::uuid() . '.' . strtolower($extension);

        if ($useSupabase) {
            try {
                $path = $file->storeAs($folder, $filename, 'supabase');
                $baseUrl = config('filesystems.disks.supabase.url');
                $url = $baseUrl ? rtrim($baseUrl, '/') . '/' . ltrim($path, '/') : Storage::disk('supabase')->url($path);
                $disk = 'supabase';
            } catch (\Throwable $e) {
                // Fallback to local public disk if connection to cloud fails
                $path = $file->storeAs($folder, $filename, 'public');
                $url = Storage::disk('public')->url($path);
                $disk = 'public';
            }
        } elseif ($useR2) {
            try {
                $path = $file->storeAs($folder, $filename, 'r2');
                $baseUrl = config('filesystems.disks.r2.url');
                $url = $baseUrl ? rtrim($baseUrl, '/') . '/' . ltrim($path, '/') : Storage::disk('r2')->url($path);
                $disk = 'r2';
            } catch (\Throwable $e) {
                // Fallback to local public disk if connection to cloud fails
                $path = $file->storeAs($folder, $filename, 'public');
                $url = Storage::disk('public')->url($path);
                $disk = 'public';
            }
        } else {
            $path = $file->storeAs($folder, $filename, 'public');
            $url = Storage::disk('public')->url($path);
            $disk = 'public';
        }

        return $this->successResponse([
            'url' => $url,
            'path' => $path,
            'disk' => $disk,
            'filename' => $filename,
        ], 'Image uploaded successfully.');
    }
}
