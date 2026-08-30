<?php

namespace App\Providers;

use App\Events\InvoicePaymentRecorded;
use App\Events\OrderCancelled;
use App\Events\OrderPlaced;
use App\Events\OrderStatusChanged;
use App\Events\StockAdjusted;
use App\Listeners\CheckLowStockThresholdListener;
use App\Listeners\LogAuditTrailListener;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\PayrollAuditLog;
use App\Models\StockMovement;
use App\Models\User;
use App\Observers\InvoiceObserver;
use App\Observers\OrderObserver;
use App\Observers\PayrollAuditLogObserver;
use App\Observers\PersonalAccessTokenObserver;
use App\Observers\StockMovementObserver;
use App\Observers\UserObserver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\PersonalAccessToken;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::preventLazyLoading(! $this->app->isProduction());
        Model::shouldBeStrict(! $this->app->isProduction());

        // Event listener registrations
        Event::listen(OrderPlaced::class, [LogAuditTrailListener::class, 'handle']);
        Event::listen(OrderPlaced::class, [CheckLowStockThresholdListener::class, 'handle']);
        Event::listen(OrderStatusChanged::class, [LogAuditTrailListener::class, 'handle']);
        Event::listen(OrderCancelled::class, [LogAuditTrailListener::class, 'handle']);
        Event::listen(StockAdjusted::class, [LogAuditTrailListener::class, 'handle']);
        Event::listen(StockAdjusted::class, [CheckLowStockThresholdListener::class, 'handle']);
        Event::listen(InvoicePaymentRecorded::class, [LogAuditTrailListener::class, 'handle']);

        // Register observers for automatic audit log syncing
        StockMovement::observe(StockMovementObserver::class);
        PersonalAccessToken::observe(PersonalAccessTokenObserver::class);
        Order::observe(OrderObserver::class);
        Invoice::observe(InvoiceObserver::class);
        User::observe(UserObserver::class);
        PayrollAuditLog::observe(PayrollAuditLogObserver::class);
    }
}
