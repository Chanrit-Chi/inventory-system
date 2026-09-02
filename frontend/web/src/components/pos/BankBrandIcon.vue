<script setup lang="ts">
import { computed } from 'vue'
import { Banknote, CreditCard, Landmark } from 'lucide-vue-next'

interface Props {
  bankName?: string
  logoUrl?: string | null
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  bankName: '',
  logoUrl: null,
  size: 18,
})

const normalizedName = computed(() => (props.bankName || '').toLowerCase().trim())

const resolvedLogoUrl = computed<string | null>(() => {
  if (props.logoUrl && (props.logoUrl.startsWith('http') || props.logoUrl.startsWith('data:') || props.logoUrl.startsWith('/'))) {
    return props.logoUrl
  }
  if (typeof window !== 'undefined' && normalizedName.value) {
    try {
      const cached = localStorage.getItem(`bank_logo_${normalizedName.value}`)
      if (cached) return cached
    } catch {
      // ignore
    }
  }
  return null
})

const bankType = computed<'custom' | 'cash' | 'aba' | 'acleda' | 'wing' | 'canadia' | 'bakong' | 'sathapana' | 'prince' | 'chipmong' | 'card' | 'generic'>(() => {
  if (resolvedLogoUrl.value) {
    return 'custom'
  }
  const n = normalizedName.value
  if (n === 'cash' || n.includes('cash') || n.includes('drawer') || n.includes('register')) {
    return 'cash'
  }
  if (n.includes('aba')) {
    return 'aba'
  }
  if (n.includes('acleda') || n.includes('acleda bank')) {
    return 'acleda'
  }
  if (n.includes('wing')) {
    return 'wing'
  }
  if (n.includes('canadia')) {
    return 'canadia'
  }
  if (n.includes('bakong') || n.includes('khqr')) {
    return 'bakong'
  }
  if (n.includes('sathapana')) {
    return 'sathapana'
  }
  if (n.includes('prince')) {
    return 'prince'
  }
  if (n.includes('chip mong') || n.includes('chipmong')) {
    return 'chipmong'
  }
  if (n.includes('card') || n.includes('visa') || n.includes('mastercard') || n.includes('terminal') || n.includes('eft')) {
    return 'card'
  }
  return 'generic'
})
</script>

<template>
  <!-- 0. Custom Logo from DB / Cache / Upload -->
  <div
    v-if="bankType === 'custom' && resolvedLogoUrl"
    class="rounded-lg bg-white border border-border flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-0.5"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px` }"
  >
    <img :src="resolvedLogoUrl" :alt="bankName || 'Bank Logo'" class="w-full h-full object-contain" />
  </div>
  <!-- 1. Cash -->
  <div
    v-if="bankType === 'cash'"
    class="rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px` }"
  >
    <Banknote :size="size" class="stroke-[2.2]" />
  </div>

  <!-- 2. ABA Bank -->
  <div
    v-else-if="bankType === 'aba'"
    class="rounded-lg bg-[#004F71] text-white flex items-center justify-center shrink-0 shadow-2xs font-black tracking-tighter"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px`, fontSize: `${Math.max(9, size * 0.55)}px` }"
    title="ABA Bank"
  >
    <span>ABA</span>
  </div>

  <!-- 3. ACLEDA Bank -->
  <div
    v-else-if="bankType === 'acleda'"
    class="rounded-lg bg-[#0B3060] text-[#E5A823] flex items-center justify-center shrink-0 shadow-2xs font-bold"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px` }"
    title="ACLEDA Bank"
  >
    <!-- Stylized ACLEDA Mythical Bird Logo -->
    <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16.5c-3.03 0-5.5-2.47-5.5-5.5 0-1.84.91-3.47 2.31-4.46l1.19 1.19c-.93.68-1.5 1.77-1.5 2.97 0 2.07 1.68 3.75 3.75 3.75 1.2 0 2.29-.57 2.97-1.5l1.19 1.19c-.99 1.4-2.62 2.31-4.46 2.31z" />
      <circle cx="12" cy="12" r="2.5" fill="#E5A823" />
    </svg>
  </div>

  <!-- 4. Wing Bank -->
  <div
    v-else-if="bankType === 'wing'"
    class="rounded-lg bg-[#00A651] text-[#D8E619] flex items-center justify-center shrink-0 shadow-2xs font-black"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px` }"
    title="Wing Bank"
  >
    <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 8l4.5 9h3L7.5 8H3zm7 0l4.5 9h3L14.5 8H10zm7 0l3 6 1.5-3L20 8h-3z" />
    </svg>
  </div>

  <!-- 5. Canadia Bank -->
  <div
    v-else-if="bankType === 'canadia'"
    class="rounded-lg bg-[#E31B23] text-white flex items-center justify-center shrink-0 shadow-2xs font-black"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px`, fontSize: `${Math.max(9, size * 0.5)}px` }"
    title="Canadia Bank"
  >
    <span>CNB</span>
  </div>

  <!-- 6. Bakong / KHQR -->
  <div
    v-else-if="bankType === 'bakong'"
    class="rounded-lg bg-[#E11B22] text-white flex items-center justify-center shrink-0 shadow-2xs font-black tracking-tight"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px`, fontSize: `${Math.max(8, size * 0.45)}px` }"
    title="Bakong / KHQR"
  >
    <span>KHQR</span>
  </div>

  <!-- 7. Sathapana Bank -->
  <div
    v-else-if="bankType === 'sathapana'"
    class="rounded-lg bg-[#003B70] text-[#E5A823] flex items-center justify-center shrink-0 shadow-2xs font-black"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px`, fontSize: `${Math.max(9, size * 0.5)}px` }"
    title="Sathapana Bank"
  >
    <span>SPN</span>
  </div>

  <!-- 8. Prince Bank -->
  <div
    v-else-if="bankType === 'prince'"
    class="rounded-lg bg-[#6C1D5F] text-white flex items-center justify-center shrink-0 shadow-2xs font-black"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px`, fontSize: `${Math.max(9, size * 0.5)}px` }"
    title="Prince Bank"
  >
    <span>PRB</span>
  </div>

  <!-- 9. Chip Mong Bank -->
  <div
    v-else-if="bankType === 'chipmong'"
    class="rounded-lg bg-[#195AA5] text-white flex items-center justify-center shrink-0 shadow-2xs font-black"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px`, fontSize: `${Math.max(9, size * 0.5)}px` }"
    title="Chip Mong Bank"
  >
    <span>CMB</span>
  </div>

  <!-- 10. Credit / Debit Card -->
  <div
    v-else-if="bankType === 'card'"
    class="rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px` }"
    title="Card Terminal"
  >
    <CreditCard :size="size" class="stroke-[2.2]" />
  </div>

  <!-- 11. Generic Bank / Payment -->
  <div
    v-else
    class="rounded-lg bg-[#FAF7F2] border border-[#E8E2D9] text-[#924C00] flex items-center justify-center shrink-0 shadow-2xs font-bold"
    :style="{ width: `${size + 10}px`, height: `${size + 10}px` }"
  >
    <Landmark :size="size" class="stroke-[2]" />
  </div>
</template>
