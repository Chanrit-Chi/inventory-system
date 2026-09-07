<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppVersionController extends BaseApiController
{
    /**
     * Check current mobile app version, required minimum version, and APK download link.
     */
    public function check(Request $request): JsonResponse
    {
        $clientPlatform = strtolower($request->query('platform', 'android'));
        $clientVersion = $request->query('version', '1.0.0');

        $latestVersion = config('app.mobile_latest_version', env('MOBILE_APP_LATEST_VERSION', '1.0.0'));
        $latestVersionCode = (int) config('app.mobile_latest_version_code', env('MOBILE_APP_LATEST_VERSION_CODE', 1));
        $minSupportedVersion = config('app.mobile_min_version', env('MOBILE_APP_MIN_VERSION', '1.0.0'));
        $apkUrl = config('app.mobile_apk_url', env('MOBILE_APP_APK_URL', ''));
        $changelog = config('app.mobile_changelog', env('MOBILE_APP_CHANGELOG', 'Performance improvements and bug fixes.'));
        $forceUpdate = config('app.mobile_force_update', (bool) env('MOBILE_APP_FORCE_UPDATE', false));

        // Version comparison
        $isUpdateAvailable = version_compare($latestVersion, $clientVersion, '>');
        $isUpdateRequired = $forceUpdate || version_compare($minSupportedVersion, $clientVersion, '>');

        return $this->successResponse([
            'platform'              => $clientPlatform,
            'client_version'        => $clientVersion,
            'latest_version'        => $latestVersion,
            'latest_version_code'   => $latestVersionCode,
            'min_supported_version' => $minSupportedVersion,
            'update_available'      => $isUpdateAvailable,
            'update_required'       => $isUpdateRequired,
            'apk_url'               => $apkUrl,
            'changelog'             => $changelog,
            'checked_at'            => now()->toIso8601String(),
        ], 'Mobile app version information retrieved.');
    }
}
