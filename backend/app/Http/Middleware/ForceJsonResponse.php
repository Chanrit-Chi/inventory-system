<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForceJsonResponse
{
    /**
     * Handle an incoming request.
     * Force JSON headers for all API requests.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Allow HTML rendering for printable receipt views (orders, invoices, quotations)
        if (
            ($request->is('*orders/*/receipt*') || $request->is('*invoices/*/receipt*') || $request->is('*quotations/*/receipt*')) &&
            ($request->header('Accept') === 'text/html' || str_contains($request->header('Accept', ''), 'text/html') || $request->query('format') === 'html')
        ) {
            return $next($request);
        }

        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
