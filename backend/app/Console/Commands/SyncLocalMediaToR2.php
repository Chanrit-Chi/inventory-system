<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class SyncLocalMediaToR2 extends Command
{
    protected $signature = 'media:sync-r2 {--folder=products}';
    protected $description = 'Sync any locally stored fallback media to Cloudflare R2 and delete local copies';

    public function handle(): int
    {
        $useR2 = !empty(config('filesystems.disks.r2.key'))
            && !empty(config('filesystems.disks.r2.secret'))
            && !empty(config('filesystems.disks.r2.bucket'));

        if (!$useR2) {
            $this->warn('Cloudflare R2 is not configured. Skipping sync.');
            return 0;
        }

        $folder = $this->option('folder') ?: 'products';
        $localFiles = Storage::disk('public')->files($folder);

        if (empty($localFiles)) {
            $this->info("No local fallback files found in {$folder}.");
            return 0;
        }

        $this->info("Found " . count($localFiles) . " local file(s). Uploading to Cloudflare R2...");

        $synced = 0;
        foreach ($localFiles as $file) {
            try {
                $contents = Storage::disk('public')->get($file);
                Storage::disk('r2')->put($file, $contents);

                // Delete local fallback file once successfully uploaded to R2
                Storage::disk('public')->delete($file);
                $synced++;
                $this->line("✓ Synced and deleted local copy: {$file}");
            } catch (\Throwable $e) {
                $this->error("✗ Failed to sync {$file}: {$e->getMessage()}");
            }
        }

        $this->info("Completed: {$synced}/" . count($localFiles) . " files synced to Cloudflare R2.");
        return 0;
    }
}
