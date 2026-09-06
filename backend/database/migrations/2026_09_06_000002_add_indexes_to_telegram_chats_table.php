<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('telegram_chats', function (Blueprint $table) {
            $table->index(['user_id', 'is_active'], 'telegram_chats_user_id_is_active_index');
            $table->index('chat_id', 'telegram_chats_chat_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('telegram_chats', function (Blueprint $table) {
            $table->dropIndex('telegram_chats_user_id_is_active_index');
            $table->dropIndex('telegram_chats_chat_id_index');
        });
    }
};
