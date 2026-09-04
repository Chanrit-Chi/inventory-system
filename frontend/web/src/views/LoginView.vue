<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useBrandingStore } from '@/stores/brandingStore'
import { useRouter, useRoute } from 'vue-router'
import { AlertCircle, Lock, Mail, ArrowRight } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import {
  Button,
  Input,
  Card,
  Alert,
} from '@/components/ui'

import { usePermissions } from '@/composables/usePermissions'

const authStore = useAuthStore()
const brandingStore = useBrandingStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { can } = usePermissions()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = computed(() => authStore.isLoading)

// Get redirect path from query parameter, fallback to role-appropriate home
const redirectPath = computed(() => {
  const target = route.query.redirect as string | undefined
  if (target && target.startsWith('/') && !target.startsWith('//')) {
    if (target === '/dashboard' && !can('reports:view')) {
      return can('pos:checkout') ? '/pos' : '/products'
    }
    return target
  }
  return can('reports:view') ? '/dashboard' : can('pos:checkout') ? '/pos' : '/products'
})

onMounted(() => {
  authStore.initAuth()
  brandingStore.fetchBranding()
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

const logoUrl = computed(() => brandingStore.branding.logo_url || '/logo.png')
const storeName = computed(() => brandingStore.branding.store_name || 'KC Shop')
const tagline = computed(() => brandingStore.branding.tagline || 'High-Velocity POS & ERP Platform')
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-cta/20 selection:text-foreground">
    <!-- Brand Header -->
    <div class="w-full max-w-md flex flex-col items-center mb-6 text-center">
      <div class="w-16 h-16 rounded-2xl bg-card border border-border/80 shadow-md p-1 flex items-center justify-center mb-3">
        <img :src="logoUrl" :alt="`${storeName} Logo`" class="w-full h-full object-contain" />
      </div>
      <h1 class="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{{ storeName }}</h1>
      <p class="text-xs text-muted-foreground mt-0.5">{{ tagline }}</p>
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
    </Card>

    <!-- Footer Security Notice -->
    <div class="mt-6 text-center text-[11px] text-muted-foreground">
      OmniPOS &bull; Enterprise Point of Sale & ERP &bull; 256-bit Encrypted Session
    </div>
  </div>
</template>
