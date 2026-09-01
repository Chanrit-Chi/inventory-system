import { defineStore } from 'pinia'
import { ref } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface ImportError {
  row: number
  message: string
}

export interface ImportResult {
  imported: number
  updated?: number
  skipped: number
  errors: ImportError[]
}

export const useImportStore = defineStore('import', () => {
  const loading = ref(false)
  const result  = ref<ImportResult | null>(null)
  const error   = ref<string | null>(null)
  const activeTab = ref<'products' | 'sales'>('products')

  function reset() {
    loading.value   = false
    result.value    = null
    error.value     = null
  }

  async function importProducts(file: File, updateExisting: boolean): Promise<ImportResult> {
    loading.value = true
    result.value  = null
    error.value   = null
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('update_existing', updateExisting ? '1' : '0')

      const res = await api.post('/import/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000, // 3 minutes
      })
      result.value = res.data.data as ImportResult
      return result.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Import failed. Please try again.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function importSales(file: File): Promise<ImportResult> {
    loading.value = true
    result.value  = null
    error.value   = null
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await api.post('/import/sales', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000, // 3 minutes
      })
      result.value = res.data.data as ImportResult
      return result.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Import failed. Please try again.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function downloadTemplate(type: 'products' | 'sales'): Promise<void> {
    try {
      const res = await api.get(`/import/template/${type}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href    = url
      a.download = `${type}_import_template.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : 'Failed to download template file.'
      error.value = msg
      throw e
    }
  }

  return {
    loading,
    result,
    error,
    activeTab,
    reset,
    importProducts,
    importSales,
    downloadTemplate,
  }
})
