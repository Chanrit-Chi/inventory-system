import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ImageUploader from '@/components/ui/ImageUploader.vue'
import ProductEditView from '@/views/ProductEditView.vue'
import ProductCreateView from '@/views/ProductCreateView.vue'
import api from '@/api/axios'

// Mock router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/products', component: { template: '<div>Catalog</div>' } },
    { path: '/products/:id/edit', component: ProductEditView },
    { path: '/products/new', component: ProductCreateView },
  ],
})

describe('Image Upload Progress & Preview System', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Mock URL.createObjectURL and revokeObjectURL in Happy-DOM
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn((file: any) => `blob:http://localhost/mock-${file?.name || 'file'}`)
    } else {
      vi.spyOn(URL, 'createObjectURL').mockImplementation((file: any) => `blob:http://localhost/mock-${file?.name || 'file'}`)
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn()
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    }
  })

  describe('ImageUploader Component', () => {
    it('renders empty dropzone state when no image modelValue is provided', () => {
      const wrapper = mount(ImageUploader, {
        props: {
          modelValue: '',
          label: 'Product Image',
          helpText: 'PNG, JPG, WEBP up to 10MB',
        },
      })

      expect(wrapper.text()).toContain('Product Image')
      expect(wrapper.text()).toContain('Click to browse')
      expect(wrapper.text()).toContain('PNG, JPG, WEBP up to 10MB')
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('renders image preview thumbnail when modelValue URL is provided', () => {
      const wrapper = mount(ImageUploader, {
        props: {
          modelValue: 'https://cdn.example.com/products/shirt-blue.jpg',
          label: 'Product Image',
        },
      })

      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('https://cdn.example.com/products/shirt-blue.jpg')
      expect(wrapper.text()).toContain('Change Image')
      expect(wrapper.text()).toContain('Remove')
      expect(wrapper.text()).toContain('Ready')
    })

    it('emits update:modelValue with empty string when Remove button is clicked', async () => {
      const wrapper = mount(ImageUploader, {
        props: {
          modelValue: 'https://cdn.example.com/products/polo.jpg',
          label: 'Product Image',
        },
      })

      const removeBtn = wrapper.findAll('button').find(b => b.text().includes('Remove'))
      expect(removeBtn?.exists()).toBe(true)
      await removeBtn?.trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([''])
      expect(wrapper.emitted('file-selected')![0]).toEqual([null])
    })

    it('handles file selection, reports upload progress, and emits uploaded URL on success', async () => {
      const postSpy = vi.spyOn(api, 'post').mockImplementation((_url, _data, config) => {
        // Trigger onUploadProgress callback to simulate progress bar
        if (config && (config as any).onUploadProgress) {
          ;(config as any).onUploadProgress({ loaded: 50, total: 100 })
        }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              url: 'https://cdn.example.com/uploads/products/new-shirt-uuid.png',
              path: 'products/new-shirt-uuid.png',
            },
          },
        }) as any
      })

      const wrapper = mount(ImageUploader, {
        props: {
          modelValue: '',
          label: 'Product Image',
          folder: 'products',
        },
      })

      const file = new File(['mock-image-bytes'], 'summer-shirt.png', { type: 'image/png' })
      const fileInput = wrapper.find('input[type="file"]')

      // Set input files
      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: true,
      })

      await fileInput.trigger('change')
      await flushPromises()

      expect(postSpy).toHaveBeenCalledWith(
        '/media/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: expect.any(Function),
        })
      )

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['https://cdn.example.com/uploads/products/new-shirt-uuid.png'])
      expect(wrapper.emitted('upload-success')).toBeTruthy()
    })

    it('displays validation error if non-image file is selected', async () => {
      const wrapper = mount(ImageUploader, {
        props: {
          modelValue: '',
        },
      })

      const badFile = new File(['text'], 'document.pdf', { type: 'application/pdf' })
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [badFile],
        writable: true,
      })

      await fileInput.trigger('change')
      await flushPromises()

      expect(wrapper.text()).toContain('Please select a valid image file')
      expect(wrapper.find('img').exists()).toBe(false)
    })
  })

  describe('ProductEditView Integration', () => {
    it('shows visual preview of product image and does not show raw URL input box', async () => {
      const mockProduct = {
        id: 'prod-456',
        name: 'Denim Jacket',
        barcode: '8859998887771',
        purchase_price: '45.00',
        selling_price: '89.00',
        default_reorder_level: 5,
        image_url: 'https://cdn.example.com/products/denim-jacket.jpg',
        is_active: true,
        variants: [],
      }

      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: mockProduct } } as any)

      await router.push('/products/prod-456/edit')
      const wrapper = mount(ProductEditView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.form.image_url).toBe('https://cdn.example.com/products/denim-jacket.jpg')

      // Verify the image is rendered visually in the preview
      const previewImg = wrapper.find('#product-edit-image img')
      expect(previewImg.exists()).toBe(true)
      expect(previewImg.attributes('src')).toBe('https://cdn.example.com/products/denim-jacket.jpg')

      // Verify there is no raw text input showing the URL
      const rawUrlInput = wrapper.find('input[type="url"]')
      expect(rawUrlInput.exists()).toBe(false)
    })

    it('updates image_url on upload and persists when saving product', async () => {
      const mockProduct = {
        id: 'prod-456',
        name: 'Denim Jacket',
        purchase_price: '45.00',
        selling_price: '89.00',
        default_reorder_level: 5,
        image_url: 'https://cdn.example.com/products/old-jacket.jpg',
        is_active: true,
        variants: [],
      }

      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: mockProduct } } as any)
      const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: { data: mockProduct } } as any)

      vi.spyOn(api, 'post').mockResolvedValue({
        data: {
          success: true,
          data: {
            url: 'https://cdn.example.com/products/new-denim-v2.png',
          },
        },
      } as any)

      await router.push('/products/prod-456/edit')
      const wrapper = mount(ProductEditView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any

      // Simulate new image upload via ImageUploader
      const file = new File(['test'], 'new-denim.png', { type: 'image/png' })
      const uploaderInput = wrapper.find('#product-edit-image input[type="file"]')
      Object.defineProperty(uploaderInput.element, 'files', {
        value: [file],
        writable: true,
      })
      await uploaderInput.trigger('change')
      await flushPromises()

      expect(vm.form.image_url).toBe('https://cdn.example.com/products/new-denim-v2.png')

      // Click save
      await vm.save()
      expect(putSpy).toHaveBeenCalledWith('/products/prod-456', expect.objectContaining({
        image_url: 'https://cdn.example.com/products/new-denim-v2.png',
      }))
    })
  })

  describe('ProductCreateView Integration', () => {
    it('renders ImageUploader in ProductCreateView with upload progress capability', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } } as any)

      await router.push('/products/new')
      const wrapper = mount(ProductCreateView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const uploader = wrapper.find('#product-create-image')
      expect(uploader.exists()).toBe(true)
      expect(uploader.text()).toContain('Product Image')
      expect(uploader.text()).toContain('Click to browse')
    })
  })
})
