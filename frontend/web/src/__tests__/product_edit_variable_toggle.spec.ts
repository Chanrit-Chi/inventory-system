import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProductEditView from '@/views/ProductEditView.vue'
import api from '@/api/axios'

vi.mock('@/api/axios', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  }
})

describe('ProductEditView - Simple to Variable Product Switching', () => {
  let router: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/products', name: 'products', component: { template: '<div />' } },
        { path: '/products/:id/edit', name: 'product-edit', component: ProductEditView },
      ],
    })
    await router.push('/products/prod-123/edit')
    await router.isReady()
    vi.clearAllMocks()
  })

  it('correctly rehydrates a simple product and switches to variable product', async () => {
    const mockSimpleProduct = {
      id: 'prod-123',
      name: 'Wireless Mouse',
      sku: 'WM-01',
      barcode: '885000000001',
      purchase_price: 15,
      selling_price: 25,
      default_reorder_level: 5,
      is_active: true,
      variants: [
        {
          id: 'var-1',
          name: 'Standard',
          sku: 'WM-01',
          barcode: '885000000001',
          cost_price: 15,
          selling_price: 25,
          quantity_on_hand: 50,
          reorder_level: 5,
          is_active: true,
          attribute_values: [],
        },
      ],
    }

    const mockAttributes = [
      {
        id: 'attr-color',
        name: 'Color',
        values: [
          { id: 'val-black', value_name: 'Black' },
          { id: 'val-white', value_name: 'White' },
        ],
      },
      {
        id: 'attr-size',
        name: 'Size',
        values: [
          { id: 'val-m', value_name: 'Medium' },
        ],
      },
    ]

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/attributes')) {
        return Promise.resolve({ data: { data: mockAttributes } } as any)
      }
      if (url.includes('/products/prod-123')) {
        return Promise.resolve({ data: { data: mockSimpleProduct } } as any)
      }
      return Promise.resolve({ data: { data: [] } } as any)
    })

    vi.mocked(api.put).mockResolvedValue({
      data: { data: { ...mockSimpleProduct, product_type: 'VARIABLE' }, message: 'Updated' },
    } as any)

    const wrapper = mount(ProductEditView, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.form.product_type).toBe('SIMPLE')
    expect(vm.form.name).toBe('Wireless Mouse')
    expect(vm.form.sku).toBe('WM-01')
    expect(vm.form.stock).toBe(50)

    // 1. Switch product type to VARIABLE
    vm.onSwitchProductType('VARIABLE')
    expect(vm.form.product_type).toBe('VARIABLE')
    expect(vm.variantRows.length).toBeGreaterThan(0)

    // 2. Select attributes and generate variants
    const colorAttr = mockAttributes[0]
    vm.toggleAttr(colorAttr)
    expect(vm.isAttrActive('attr-color')).toBe(true)

    vm.toggleValue('attr-color', 'Black')
    vm.toggleValue('attr-color', 'White')
    expect(vm.isValueActive('attr-color', 'Black')).toBe(true)
    expect(vm.isValueActive('attr-color', 'White')).toBe(true)

    // Generate Cartesian combinations
    vm.generateVariantsFromAttributes()
    expect(vm.variantRows.length).toBe(2)
    expect(vm.variantRows[0].name).toBe('Black')
    expect(vm.variantRows[1].name).toBe('White')

    // 3. Add manual variation
    vm.addManualVariant()
    expect(vm.variantRows.length).toBe(3)
    expect(vm.variantRows[2].name).toBe('Variation 3')

    // 4. Remove a variation
    vm.removeVariantRow(2)
    expect(vm.variantRows.length).toBe(2)

    // 5. Save changes as VARIABLE product
    await vm.save()
    await flushPromises()

    expect(api.put).toHaveBeenCalledWith(
      '/products/prod-123',
      expect.objectContaining({
        name: 'Wireless Mouse',
        product_type: 'VARIABLE',
        variants: expect.arrayContaining([
          expect.objectContaining({ name: 'Black' }),
          expect.objectContaining({ name: 'White' }),
        ]),
      })
    )
  })

  it('allows switching from VARIABLE back to SIMPLE product', async () => {
    const mockVariableProduct = {
      id: 'prod-123',
      name: 'T-Shirt',
      purchase_price: 10,
      selling_price: 20,
      default_reorder_level: 5,
      is_active: true,
      variants: [
        {
          id: 'var-10',
          name: 'Red',
          sku: 'TSH-RED',
          barcode: '111111',
          cost_price: 10,
          selling_price: 20,
          quantity_on_hand: 15,
          reorder_level: 5,
          is_active: true,
          attribute_values: [{ attribute_id: 'attr-color', value_name: 'Red' }],
        },
        {
          id: 'var-11',
          name: 'Blue',
          sku: 'TSH-BLU',
          barcode: '222222',
          cost_price: 10,
          selling_price: 20,
          quantity_on_hand: 25,
          reorder_level: 5,
          is_active: true,
          attribute_values: [{ attribute_id: 'attr-color', value_name: 'Blue' }],
        },
      ],
    }

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/products/prod-123')) {
        return Promise.resolve({ data: { data: mockVariableProduct } } as any)
      }
      return Promise.resolve({ data: { data: [] } } as any)
    })

    vi.mocked(api.put).mockResolvedValue({
      data: { data: mockVariableProduct, message: 'Updated' },
    } as any)

    const wrapper = mount(ProductEditView, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.form.product_type).toBe('VARIABLE')
    expect(vm.variantRows.length).toBe(2)

    // Switch to SIMPLE
    vm.onSwitchProductType('SIMPLE')
    expect(vm.form.product_type).toBe('SIMPLE')

    vm.form.stock = 40
    vm.form.barcode = '999999'

    await vm.save()
    await flushPromises()

    expect(api.put).toHaveBeenCalledWith(
      '/products/prod-123',
      expect.objectContaining({
        name: 'T-Shirt',
        product_type: 'SIMPLE',
        quantity_on_hand: 40,
        variants: [
          expect.objectContaining({
            name: 'Standard',
            barcode: '999999',
            quantity_on_hand: 40,
          }),
        ],
      })
    )
  })
})
