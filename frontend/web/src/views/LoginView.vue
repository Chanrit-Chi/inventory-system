<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useRouter, useRoute } from 'vue-router'
import { AlertCircle, Lock, Mail, ArrowRight, Shield } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import {
  Button,
  Badge,
  Input,
  Card,
  Alert,
} from '@/components/ui'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = computed(() => authStore.isLoading)

// Get redirect path from query parameter, fallback to dashboard
const redirectPath = computed(() => {
  const target = route.query.redirect as string | undefined
  if (target && target.startsWith('/') && !target.startsWith('//')) {
    return target
  }
  return '/dashboard'
})

onMounted(() => {
  authStore.initAuth()
  if (authStore.isAuthenticated) {
    router.push(redirectPath.value)
  }
})

const handleLogin = async () => {
  error.value = ''

  if (!email.value || !password.value) {
    error.value = 'Please enter both email and password'
    return
  }

  const result = await authStore.login(email.value, password.value)

  if (result.success) {
    toast.success('Login successful!')
    router.push(redirectPath.value)
  } else {
    error.value = result.error || 'Login failed. Please try again.'
  }
}
const logoUrl = ref('/logo.png')
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-cta/20 selection:text-foreground">
    <!-- Brand Header -->
    <div class="w-full max-w-md flex flex-col items-center mb-6">
      <div class="w-16 h-16 rounded-2xl bg-card border border-border/80 shadow-md p-2 flex items-center justify-center mb-3">
        <img :src="logoUrl" alt="OmniPOS Logo" class="max-h-full max-w-full object-contain" />
      </div>
      <h1 class="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">OmniPOS Retail</h1>
      <p class="text-xs text-muted-foreground mt-0.5">High-Velocity Omnichannel POS & ERP Platform</p>
    </div>

    <!-- Login Card -->
    <Card class="w-full max-w-md p-6 sm:p-8 shadow-sm flex flex-col gap-5">
      <div>
        <h2 class="font-display font-bold text-lg text-foreground">Sign In to Store Register</h2>
        <p class="text-xs text-muted-foreground mt-0.5">Enter your operator credentials to unlock the POS terminal.</p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
        <div>
          <label for="email-address" class="block text-xs font-semibold text-foreground mb-1">Email Address</label>
          <div class="relative">
            <Mail :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email-address"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              placeholder="operator@omnipos.local"
              class="pl-9 h-10 bg-surface text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label for="password" class="block text-xs font-semibold text-foreground mb-1">Password</label>
          <div class="relative">
            <Lock :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              placeholder="••••••••"
              class="pl-9 h-10 bg-surface text-sm font-mono"
            />
          </div>
        </div>

        <Alert v-if="error" variant="error">
          <div class="flex items-center gap-2">
            <AlertCircle :size="15" class="flex-shrink-0" />
            <span>{{ error }}</span>
          </div>
        </Alert>

        <Button
          type="submit"
          variant="cta"
          class="h-10 w-full gap-2 text-sm font-semibold mt-1"
          :disabled="isLoading"
        >
          <span v-if="isLoading" class="animate-spin mr-1">⏳</span>
          <span v-if="!isLoading">Sign In</span>
          <span v-else>Authenticating…</span>
          <ArrowRight v-if="!isLoading" :size="15" />
        </Button>
      </form>

      <!-- Demo Accounts -->
      <div class="pt-4 border-t border-border flex flex-col gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Shield :size="12" />
          <span>Quick Login Test Accounts</span>
        </span>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            class="p-2.5 rounded-lg border border-border/80 bg-surface-subtle/60 hover:bg-surface-subtle text-left transition-colors cursor-pointer"
            @click="email = 'admin@inventory.local'; password = 'password'"
          >
            <div class="font-bold text-foreground flex items-center justify-between">
              <span>Admin Account</span>
              <Badge variant="info" class="text-[9px] px-1 py-0">Admin</Badge>
            </div>
            <div class="font-mono text-[10px] text-muted-foreground truncate mt-0.5">admin@inventory.local</div>
          </button>

          <button
            type="button"
            class="p-2.5 rounded-lg border border-border/80 bg-surface-subtle/60 hover:bg-surface-subtle text-left transition-colors cursor-pointer"
            @click="email = 'seller@inventory.local'; password = 'password'"
          >
            <div class="font-bold text-foreground flex items-center justify-between">
              <span>Cashier Account</span>
              <Badge variant="neutral" class="text-[9px] px-1 py-0">Seller</Badge>
            </div>
            <div class="font-mono text-[10px] text-muted-foreground truncate mt-0.5">seller@inventory.local</div>
          </button>
        </div>
      </div>
    </Card>

    <!-- Footer Security Notice -->
    <div class="mt-6 text-center text-[11px] text-muted-foreground">
      OmniPOS &bull; Enterprise Point of Sale & ERP &bull; 256-bit Encrypted Session
    </div>
  </div>
</template>
