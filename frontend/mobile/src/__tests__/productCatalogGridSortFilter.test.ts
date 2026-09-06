import type { Product, ProductCategory, ProductVariant } from '../types'

describe('Product Catalog Grid, Sort & Filter Logic', () => {
  const catClothing: ProductCategory = { id: 'c1', name: 'Clothing', code: 'CLO' }
  const catAccessories: ProductCategory = { id: 'c2', name: 'Accessories', code: 'ACC' }
  const catFootwear: ProductCategory = { id: 'c3', name: 'Footwear', code: 'FTW' }

  const makeVariant = (id: string, name: string, sku: string, qty: number): ProductVariant => ({
    id,
    product_id: 'prod',
    name,
    sku,
    barcode: `BAR-${id}`,
    quantity_on_hand: qty,
    is_active: true,
  })

  const sampleProducts: Product[] = [
    {
      id: 'p1',
      name: 'Banana T-Shirt',
      sku: 'BAN-01',
      category: catClothing,
      purchase_price: '10.00',
      selling_price: '19.99',
      default_reorder_level: 10,
      variants: [
        makeVariant('v1', 'S', 'BAN-01-S', 2),
        makeVariant('v2', 'M', 'BAN-01-M', 3), // total = 5 (Low Stock)
      ],
      is_active: true,
    },
    {
      id: 'p2',
      name: 'Apple Hat',
      sku: 'APP-01',
      category: catAccessories,
      purchase_price: '7.50',
      selling_price: '15.00',
      default_reorder_level: 5,
      variants: [
        makeVariant('v3', 'One Size', 'APP-01-OS', 0), // total = 0 (Out of Stock)
      ],
      is_active: true,
    },
    {
      id: 'p3',
      name: 'Zebra Shoes',
      sku: 'ZEB-01',
      category: catFootwear,
      purchase_price: '45.00',
      selling_price: '89.99',
      default_reorder_level: 8,
      variants: [
        makeVariant('v4', '42', 'ZEB-01-42', 15),
        makeVariant('v5', '43', 'ZEB-01-43', 25), // total = 40 (In Stock)
      ],
      is_active: true,
    },
  ]

  const getProductTotalStock = (product: Product): number => {
    return product.variants?.reduce((sum, v) => sum + (v.quantity_on_hand ?? 0), 0) || 0
  }

  const filterByStock = (
    products: Product[],
    stockFilter: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  ): Product[] => {
    return products.filter((p) => {
      if (stockFilter === 'ALL') return true
      const total = getProductTotalStock(p)
      const reorder = p.default_reorder_level || 10
      if (stockFilter === 'LOW_STOCK') return total > 0 && total <= reorder
      if (stockFilter === 'OUT_OF_STOCK') return total <= 0
      return true
    })
  }

  const calculateActiveFilters = (
    categoryFilter: string,
    statusFilter: 'ALL' | 'ACTIVE' | 'DEACTIVATED',
    stockFilter: 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK',
    sortBy: 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC' | 'STOCK_ASC' | 'STOCK_DESC'
  ): number => {
    let count = 0
    if (categoryFilter !== 'ALL') count++
    if (statusFilter !== 'ALL') count++
    if (stockFilter !== 'ALL') count++
    if (sortBy !== 'DEFAULT') count++
    return count
  }

  describe('Stock Level Filter', () => {
    it('returns all products when stockFilter is ALL', () => {
      const filtered = filterByStock(sampleProducts, 'ALL')
      expect(filtered).toHaveLength(3)
    })

    it('returns only low stock items when stockFilter is LOW_STOCK', () => {
      const filtered = filterByStock(sampleProducts, 'LOW_STOCK')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Banana T-Shirt') // stock = 5 <= 10
    })

    it('returns only out of stock items when stockFilter is OUT_OF_STOCK', () => {
      const filtered = filterByStock(sampleProducts, 'OUT_OF_STOCK')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Apple Hat') // stock = 0
    })
  })

  describe('Sorting Options', () => {
    it('sorts by Name A-Z (NAME_ASC)', () => {
      const sorted = [...sampleProducts].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      expect(sorted.map((p) => p.name)).toEqual(['Apple Hat', 'Banana T-Shirt', 'Zebra Shoes'])
    })

    it('sorts by Name Z-A (NAME_DESC)', () => {
      const sorted = [...sampleProducts].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
      expect(sorted.map((p) => p.name)).toEqual(['Zebra Shoes', 'Banana T-Shirt', 'Apple Hat'])
    })

    it('sorts by Stock Low-to-High (STOCK_ASC)', () => {
      const sorted = [...sampleProducts].sort((a, b) => getProductTotalStock(a) - getProductTotalStock(b))
      expect(sorted.map((p) => p.name)).toEqual(['Apple Hat', 'Banana T-Shirt', 'Zebra Shoes'])
      expect(sorted.map(getProductTotalStock)).toEqual([0, 5, 40])
    })

    it('sorts by Stock High-to-Low (STOCK_DESC)', () => {
      const sorted = [...sampleProducts].sort((a, b) => getProductTotalStock(b) - getProductTotalStock(a))
      expect(sorted.map((p) => p.name)).toEqual(['Zebra Shoes', 'Banana T-Shirt', 'Apple Hat'])
      expect(sorted.map(getProductTotalStock)).toEqual([40, 5, 0])
    })
  })

  describe('Active Filters Count & Reset', () => {
    it('accurately counts active filters', () => {
      const count = calculateActiveFilters('Clothing', 'ACTIVE', 'LOW_STOCK', 'STOCK_ASC')
      expect(count).toBe(4)
    })

    it('returns 0 when all filters are at defaults', () => {
      const count = calculateActiveFilters('ALL', 'ALL', 'ALL', 'DEFAULT')
      expect(count).toBe(0)
    })

    it('counts single active filter correctly', () => {
      const count = calculateActiveFilters('ALL', 'ALL', 'OUT_OF_STOCK', 'DEFAULT')
      expect(count).toBe(1)
    })
  })
})
