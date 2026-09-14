<script setup lang="ts">
import { Server, Database, RefreshCw } from 'lucide-vue-next'
import {
  Button,
  Badge,
  Card,
  StatCard,
} from '@/components/ui'

interface Props {
  healthStatus: {
    connected: boolean
    status: string
    version: string
    app: string
    database: string
    latency: string
    lastChecked?: string
    databaseDriver?: string
    databaseStatus?: string
    databaseLatency?: string
    queueDriver?: string
    cacheDriver?: string
    environment?: string
    phpVersion?: string
    laravelVersion?: string
    serverTime?: string
  }
  healthLoading?: boolean
  cacheClearing?: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'check-health'): void
  (e: 'clear-cache'): void
}>()
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <StatCard
        label="Backend API Service"
        :value="healthStatus.status || 'Active'"
        :sub="`Latency: ${healthStatus.latency} • Last checked: ${healthStatus.lastChecked || 'Just now'}`"
        :icon="Server"
        :icon-variant="healthStatus.connected ? 'success' : 'warning'"
      />
      <StatCard
        label="Database Engine"
        :value="healthStatus.database || 'Active'"
        :sub="`State: ${healthStatus.databaseStatus || 'Online'}${healthStatus.databaseLatency ? ' (' + healthStatus.databaseLatency + ')' : ''} • Queue: ${healthStatus.queueDriver || 'sync'}`"
        :icon="Database"
        :icon-variant="healthStatus.connected ? 'success' : 'warning'"
      />
    </div>

    <Card class="p-6 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-display font-bold text-base text-foreground">Application Build & Runtime Details</h3>
          <p class="text-xs text-muted-foreground mt-0.5">Platform runtime identifiers, server environment, and active drivers.</p>
        </div>
        <Badge :variant="healthStatus.connected ? 'success' : 'neutral'" class="font-mono text-xs">
          {{ healthStatus.environment ? healthStatus.environment.toUpperCase() : 'PRODUCTION' }}
        </Badge>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
          <span class="text-muted-foreground font-semibold">Application</span>
          <span class="font-semibold text-foreground">{{ healthStatus.app }}</span>
        </div>
        <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
          <span class="text-muted-foreground font-semibold">Framework Runtime</span>
          <span class="font-mono font-semibold text-foreground">
            {{ healthStatus.phpVersion ? `PHP ${healthStatus.phpVersion} (Laravel ${healthStatus.laravelVersion || '12'})` : `Laravel API (${healthStatus.version})` }}
          </span>
        </div>
        <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
          <span class="text-muted-foreground font-semibold">API Base Path</span>
          <code class="font-mono text-primary text-xs">/api/v1</code>
        </div>
        <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
          <span class="text-muted-foreground font-semibold">Queue Driver</span>
          <span class="font-mono text-foreground font-semibold">{{ healthStatus.queueDriver || 'sync' }}</span>
        </div>
        <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
          <span class="text-muted-foreground font-semibold">Cache Driver</span>
          <span class="font-mono text-foreground font-semibold">{{ healthStatus.cacheDriver || 'file' }}</span>
        </div>
        <div class="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
          <span class="text-muted-foreground font-semibold">Server Clock</span>
          <span class="font-mono text-foreground text-[11px]">{{ healthStatus.serverTime || new Date().toISOString() }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 border-t border-border">
        <div>
          <span class="font-semibold text-xs text-foreground block">Health Check Trigger</span>
          <span class="text-[11px] text-muted-foreground">Ping backend microservices and calculate gateway round-trip time.</span>
        </div>
        <Button
          id="btn-check-health"
          variant="outline"
          size="sm"
          class="text-xs gap-1.5"
          :disabled="healthLoading"
          @click="emit('check-health')"
        >
          <RefreshCw :size="13" :class="{ 'animate-spin': healthLoading }" />
          <span>{{ healthLoading ? 'Checking…' : 'Run Health Check' }}</span>
        </Button>
      </div>
    </Card>

    <Card class="p-6 flex items-center justify-between">
      <div>
        <h3 class="font-display font-bold text-base text-foreground">Local Cache Management</h3>
        <p class="text-xs text-muted-foreground mt-0.5">Clear locally cached printer hardware records and session memory.</p>
      </div>
      <Button
        id="btn-clear-cache"
        variant="destructive"
        size="sm"
        :disabled="cacheClearing"
        @click="emit('clear-cache')"
      >
        <span v-if="cacheClearing" class="animate-spin mr-1">⏳</span>
        <span>{{ cacheClearing ? 'Clearing…' : 'Clear Local Cache' }}</span>
      </Button>
    </Card>
  </div>
</template>
