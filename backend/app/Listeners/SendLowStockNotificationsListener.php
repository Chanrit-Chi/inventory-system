<?php

namespace App\Listeners;

use App\Events\LowStockDetected;
use App\Services\PushNotificationService;
use App\Services\TelegramNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class SendLowStockNotificationsListener implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'notifications';

    public function __construct(
        protected PushNotificationService $pushService,
        protected TelegramNotificationService $telegramService
    ) {}

    public function handle(LowStockDetected $event): void
    {
        $variant = $event->variant;

        $this->pushService->notifyLowStock($variant);
        $this->telegramService->notifyLowStock($variant);
    }
}