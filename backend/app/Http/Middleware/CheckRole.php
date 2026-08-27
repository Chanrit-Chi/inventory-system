<?php

namespace App\Http\Middleware;

use App\Traits\ApiResponseTrait;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    use ApiResponseTrait;

    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string  ...$roles
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        // 1. Enforce authentication
        if (! $user) {
            return $this->errorResponse('Unauthenticated.', null, 401);
        }

        // 2. Enforce active account status
        if (! $user->is_active) {
            return $this->errorResponse('Your account has been deactivated. Contact an administrator.', null, 403);
        }

        // 3. Normalize current authenticated user's role
        $userRole = strtoupper(trim((string) $user->role));
        if ($userRole === 'CASHIER') {
            $userRole = 'SELLER';
        }

        // 4. SUPER_ADMIN super-user bypass
        if ($userRole === 'SUPER_ADMIN' || (method_exists($user, 'hasPermission') && $user->hasPermission('*'))) {
            return $next($request);
        }

        // 5. Flatten and normalize requirements from middleware arguments
        $requirements = [];
        foreach ($roles as $roleArg) {
            foreach (preg_split('/[,|]/', (string) $roleArg) as $item) {
                $trimmed = trim($item);
                if ($trimmed !== '') {
                    $requirements[] = $trimmed;
                }
            }
        }

        // If no specific requirements provided, allow access
        if (empty($requirements)) {
            return $next($request);
        }

        // 6. Check if user satisfies any requirement (by role name or dynamic capability)
        $authorized = false;
        foreach ($requirements as $req) {
            $upperReq = strtoupper($req);
            $normalizedRole = ($upperReq === 'CASHIER') ? 'SELLER' : $upperReq;

            // Direct role match
            if ($userRole === $normalizedRole) {
                $authorized = true;
                break;
            }

            // Dynamic capability/permission check
            if (method_exists($user, 'hasPermission') && $user->hasPermission($req)) {
                $authorized = true;
                break;
            }
        }

        if (! $authorized) {
            return $this->errorResponse('Unauthorized role access.', null, 403);
        }

        return $next($request);
    }
}
