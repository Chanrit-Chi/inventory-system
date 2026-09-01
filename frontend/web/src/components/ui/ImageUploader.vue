<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UploadCloud, X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import api, { ApiError } from '@/api/axios'
import { useToast } from '@/composables/useToast'
import Button from './Button.vue'
import Badge from './Badge.vue'

interface Props {
  modelValue?: string | null
  label?: string
  folder?: string
  disabled?: boolean
  aspectRatio?: 'square' | 'video' | 'wide' | 'auto'
  helpText?: string
  maxSizeMb?: number
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: 'Image',
  folder: 'products',
  disabled: false,
  aspectRatio: 'auto',
  helpText: 'PNG, JPG, WEBP, or GIF up to 10MB',
  maxSizeMb: 10,
  id: 'image-uploader',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'upload-success', data: { url: string; file: File }): void
  (e: 'upload-error', error: unknown): void
  (e: 'file-selected', file: File | null): void
}>()

const toast = useToast()
const fileInputRef = ref<HTMLInputElement | null>(null)

const isDragging = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref<string | null>(null)
const localPreviewUrl = ref<string | null>(null)
const currentFileName = ref<string>('')
const currentFileSize = ref<string>('')
const activeFile = ref<File | null>(null)
const imageLoadError = ref(false)

const currentImage = computed(() => {
  if (localPreviewUrl.value) return localPreviewUrl.value
  return props.modelValue || ''
})

const hasImage = computed(() => {
  return Boolean(currentImage.value && !imageLoadError.value)
})

watch(() => props.modelValue, (newVal) => {
  if (newVal !== localPreviewUrl.value) {
    imageLoadError.value = false
  }
})

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function triggerFileInput() {
  if (props.disabled || isUploading.value) return
  fileInputRef.value?.click()
}

function handleDragEnter(e: DragEvent) {
  if (props.disabled || isUploading.value) return
  e.preventDefault()
  isDragging.value = true
}

function handleDragOver(e: DragEvent) {
  if (props.disabled || isUploading.value) return
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  if (props.disabled || isUploading.value) return
  e.preventDefault()
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  if (props.disabled || isUploading.value) return
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    processFile(files[0])
  }
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processFile(file)
  }
  // Reset input value so re-selecting same file triggers change
  target.value = ''
}

async function processFile(file: File) {
  uploadError.value = null
  imageLoadError.value = false

  // Validate type
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Please select a valid image file (PNG, JPG, WebP, GIF).'
    toast.error(uploadError.value)
    return
  }

  // Validate size
  const maxBytes = props.maxSizeMb * 1024 * 1024
  if (file.size > maxBytes) {
    uploadError.value = `Image exceeds maximum allowed size of ${props.maxSizeMb}MB.`
    toast.error(uploadError.value)
    return
  }

  activeFile.value = file
  currentFileName.value = file.name
  currentFileSize.value = formatBytes(file.size)

  // Clean previous local object URL
  if (localPreviewUrl.value && localPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }

  // Create immediate local preview
  localPreviewUrl.value = URL.createObjectURL(file)
  emit('file-selected', file)

  await uploadFile(file)
}

async function uploadFile(file: File) {
  isUploading.value = true
  uploadProgress.value = 0
  uploadError.value = null

  const formData = new FormData()
  formData.append('image', file)
  formData.append('folder', props.folder)

  try {
    const res = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          uploadProgress.value = Math.min(percent, 99)
        } else {
          uploadProgress.value = Math.min(uploadProgress.value + 15, 90)
        }
      },
    })

    uploadProgress.value = 100
    const uploadedUrl = res.data?.data?.url || res.data?.url

    if (uploadedUrl) {
      emit('update:modelValue', uploadedUrl)
      emit('upload-success', { url: uploadedUrl, file })
      toast.success('Image uploaded successfully')
    } else {
      // Fallback: keep local preview
      emit('upload-success', { url: localPreviewUrl.value || '', file })
    }
  } catch (err: unknown) {
    let msg = 'Failed to upload image. Please try again.'
    if (err instanceof ApiError) {
      msg = err.message
    } else if (err instanceof Error) {
      msg = err.message
    }
    uploadError.value = msg
    emit('upload-error', err)
    toast.error(msg)
  } finally {
    setTimeout(() => {
      isUploading.value = false
    }, 400)
  }
}

function removeImage() {
  if (props.disabled || isUploading.value) return
  if (localPreviewUrl.value && localPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
  localPreviewUrl.value = null
  currentFileName.value = ''
  currentFileSize.value = ''
  activeFile.value = null
  imageLoadError.value = false
  uploadError.value = null
  uploadProgress.value = 0
  emit('update:modelValue', '')
  emit('file-selected', null)
}

function retryUpload() {
  if (activeFile.value) {
    uploadFile(activeFile.value)
  } else {
    triggerFileInput()
  }
}

onUnmounted(() => {
  if (localPreviewUrl.value && localPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
})

defineExpose({
  triggerFileInput,
  removeImage,
  retryUpload,
  isUploading,
  uploadProgress,
  hasImage,
  currentImage,
})
</script>

<template>
  <div class="flex flex-col gap-1.5 w-full" :id="id">
    <!-- Label and Optional Action Header -->
    <div class="flex items-center justify-between">
      <label class="block text-xs font-semibold text-foreground">
        {{ label }}
      </label>
      <span v-if="isUploading" class="text-3xs font-mono font-bold text-primary flex items-center gap-1">
        <RefreshCw :size="10" class="animate-spin" />
        Uploading {{ uploadProgress }}%
      </span>
      <span v-else-if="hasImage" class="text-3xs text-muted-foreground font-mono">
        {{ currentFileSize || 'Active Image' }}
      </span>
    </div>

    <!-- Hidden native file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
      class="hidden"
      :disabled="disabled || isUploading"
      @change="handleFileChange"
    />

    <!-- Main Container -->
    <div
      class="relative rounded-xl border transition-all overflow-hidden bg-surface"
      :class="[
        isDragging
          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
          : uploadError
            ? 'border-destructive/60 bg-destructive/5'
            : hasImage
              ? 'border-border shadow-2xs'
              : 'border-dashed border-border hover:border-border-strong hover:bg-surface-subtle/50',
        disabled ? 'opacity-60 pointer-events-none' : '',
      ]"
      @dragenter="handleDragEnter"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- STATE 1: Existing or Selected Image Preview -->
      <div v-if="hasImage" class="relative group p-3 flex flex-col sm:flex-row items-center gap-4">
        <!-- Thumbnail Preview Box -->
        <div
          class="relative w-28 h-28 sm:w-32 sm:h-32 rounded-lg bg-surface-subtle border border-border/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs group/thumb"
        >
          <img
            :src="currentImage"
            :alt="label"
            class="w-full h-full object-contain transition-transform duration-200 group-hover/thumb:scale-105"
            @error="imageLoadError = true"
          />

          <!-- Uploading Overlay with Progress Spinner & Percentage -->
          <div
            v-if="isUploading"
            class="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 p-2 z-10"
          >
            <div class="relative flex items-center justify-center">
              <RefreshCw :size="24" class="animate-spin text-primary" />
            </div>
            <span class="text-xs font-mono font-bold text-foreground">{{ uploadProgress }}%</span>
          </div>
        </div>

        <!-- Details & Actions Panel -->
        <div class="flex-1 flex flex-col justify-between self-stretch gap-2 min-w-0 w-full">
          <div>
            <div class="flex items-center gap-2">
              <Badge variant="success" class="text-[10px] font-medium gap-1 px-1.5 py-0">
                <CheckCircle2 :size="11" />
                <span>Ready</span>
              </Badge>
              <span v-if="currentFileName" class="text-xs font-medium text-foreground truncate max-w-[200px]" :title="currentFileName">
                {{ currentFileName }}
              </span>
            </div>
            <p class="text-[11px] text-muted-foreground mt-1">
              Visual preview active for POS registers, catalogs, and customer receipts.
            </p>
          </div>

          <!-- Progress Bar during Upload -->
          <div v-if="isUploading" class="space-y-1 w-full">
            <div class="flex justify-between text-3xs font-mono text-muted-foreground">
              <span>Uploading to cloud storage…</span>
              <span>{{ uploadProgress }}%</span>
            </div>
            <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full transition-all duration-200"
                :style="{ width: `${uploadProgress}%` }"
              />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-8 px-2.5 text-xs gap-1.5"
              :disabled="isUploading || disabled"
              @click="triggerFileInput"
            >
              <RefreshCw :size="12" />
              <span>Change Image</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 gap-1.5"
              :disabled="isUploading || disabled"
              @click="removeImage"
            >
              <X :size="12" />
              <span>Remove</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- STATE 2: Empty Dropzone State (No image selected yet) -->
      <div
        v-else
        class="flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors"
        @click="triggerFileInput"
      >
        <!-- Icon Container -->
        <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
          <UploadCloud v-if="!isUploading" :size="24" />
          <RefreshCw v-else :size="24" class="animate-spin text-primary" />
        </div>

        <div class="space-y-1">
          <p class="text-xs font-semibold text-foreground">
            <span v-if="!isUploading" class="text-primary hover:underline">Click to browse</span>
            <span v-if="!isUploading"> or drag and drop</span>
            <span v-else>Uploading image… ({{ uploadProgress }}%)</span>
          </p>
          <p class="text-[11px] text-muted-foreground">
            {{ helpText }}
          </p>
        </div>

        <!-- Progress Bar when uploading into empty state -->
        <div v-if="isUploading" class="w-full max-w-xs mt-3 space-y-1">
          <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-200"
              :style="{ width: `${uploadProgress}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Error Banner with Retry -->
    <div
      v-if="uploadError"
      class="flex items-center justify-between p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive mt-1"
    >
      <div class="flex items-center gap-2">
        <AlertCircle :size="14" class="shrink-0" />
        <span>{{ uploadError }}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-6 px-2 text-3xs text-destructive hover:bg-destructive/20"
        @click="retryUpload"
      >
        Retry
      </Button>
    </div>
  </div>
</template>
