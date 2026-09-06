<?php

namespace App\Console\Commands;

use App\Services\TelegramNotificationService;
use Illuminate\Console\Command;

class TelegramSetupCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'telegram:setup
                            {url? : The public base URL (e.g. https://api.yourdomain.com)}
                            {--info : Only display current Telegram webhook and bot status}
                            {--delete-webhook : Remove the current webhook from Telegram}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Configure Telegram Bot Webhook and Mini App menu button for production or local tunnel';

    /**
     * Execute the console command.
     */
    public function handle(TelegramNotificationService $service): int
    {
        $this->info('=============================================');
        $this->info('  KC Shop — Telegram Bot Configuration Tool  ');
        $this->info('=============================================');

        $botUsername = $service->getBotUsername();
        $this->line("Bot Username: <comment>@{$botUsername}</comment>");

        // 1. Info only
        if ($this->option('info')) {
            $this->displayWebhookInfo($service);
            return Command::SUCCESS;
        }

        // 2. Delete webhook
        if ($this->option('delete-webhook')) {
            $this->warn('Deleting webhook from Telegram...');
            $res = \Illuminate\Support\Facades\Http::timeout(10)->post($service->getApiUrl() . '/deleteWebhook');
            $this->info($res->body());
            return Command::SUCCESS;
        }

        // 3. Resolve Base URL
        $baseUrl = $this->argument('url');
        if (!$baseUrl) {
            $baseUrl = config('services.telegram.miniapp_url')
                ? preg_replace('#/telegram/app.*$#', '', config('services.telegram.miniapp_url'))
                : config('app.url');
        }

        $baseUrl = rtrim((string)$baseUrl, '/');

        if (empty($baseUrl) || !str_starts_with($baseUrl, 'https://')) {
            $this->error('Error: Telegram requires an HTTPS URL. Received: ' . ($baseUrl ?: '(empty)'));
            $this->line('Example: php artisan telegram:setup https://api.kcshop.com');
            return Command::FAILURE;
        }

        $webhookUrl = "{$baseUrl}/api/v1/telegram/webhook";
        $miniappUrl = "{$baseUrl}/telegram/app";

        $this->newLine();
        $this->line("Setting Webhook URL:  <info>{$webhookUrl}</info>");
        $this->line("Setting Mini App URL: <info>{$miniappUrl}</info>");
        $this->newLine();

        // Register Webhook
        $res = $service->setWebhook($webhookUrl);
        if (!$res['success']) {
            $this->error("Failed to set webhook: {$res['description']}");
            return Command::FAILURE;
        }
        $this->info("Webhook registered: {$webhookUrl}");

        // Register Menu Button
        $menuOk = $service->setChatMenuButton($miniappUrl, '📱 Open KC Shop');
        if ($menuOk) {
            $this->info("Chat menu button set: {$miniappUrl}");
        } else {
            $this->warn("Failed to set chat menu button.");
        }

        $this->newLine();
        $this->info('Telegram Bot URLs updated successfully! 🎉');
        $this->newLine();

        $this->displayWebhookInfo($service);

        return Command::SUCCESS;
    }

    protected function displayWebhookInfo(TelegramNotificationService $service): void
    {
        $info = $service->getWebhookInfo();
        if ($info['ok'] ?? false) {
            $res = $info['result'] ?? [];
            $this->line('<options=bold>Current Telegram Webhook Status:</>');
            $this->table(['Key', 'Value'], [
                ['Webhook URL', $res['url'] ?? '(none)'],
                ['Pending Updates', $res['pending_update_count'] ?? 0],
                ['Last Error Date', isset($res['last_error_date']) ? date('Y-m-d H:i:s', $res['last_error_date']) : 'None'],
                ['Last Error Msg', $res['last_error_message'] ?? 'None'],
            ]);
        } else {
            $this->warn('Could not fetch webhook info: ' . json_encode($info));
        }
    }
}
