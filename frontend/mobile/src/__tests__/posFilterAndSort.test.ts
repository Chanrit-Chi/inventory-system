import type { Product, ProductCategory, ProductVariant } from '../types'
import type {
  PosSortOption,
  PosStockOption,
  PosStatusOption,
  PosProductTypeOption,
} from '../screens/pos/components/PosFilterModal'

describe('POS Screen Filter & Sort Logic', () => {
  const catCoffee: ProductCategory = { id: 'c1', name: 'Coffee', code: 'COF' }
  const catBakery: ProductCategory = { id: 'c2', name: 'Bakery', code: 'BAK' }
  const catMerch: ProductCategory = { id: 'c3', name: 'Merchandise', code: 'MER' }

  const makeVariant = (
    id: string,
    name: string,
    sku: string,
    qty: number,
    sellingPrice?: string,
    attributeValues?: Array<{ id: string; value_name: string }>
  ): ProductVariant => ({
    id,
    product_id: 'prod',
    name,
    sku,
    barcode: `BAR-${id}`,
    quantity_on_hand: qty,
    selling_price: sellingPrice || '5.00',
    is_active: true,
    attribute_values: attributeValues,
  })

  const samplePosProducts: Product[] = [
    {
      id: 'p1',
      name: 'Espresso Roast',
      sku: 'ESP-01',
      category: catCoffee,
      purchase_price: '4.00',
      selling_price: '8.50',
      default_reorder_level: 10,
      variants: [
        makeVariant('v1', 'Default', 'ESP-01-DEF', 4), // Low stock (4 <= 10)
      ],
      is_active: true,
    },
    {
      id: 'p2',
      name: 'Almond Croissant',
      sku: 'CRO-01',
      category: catBakery,
      purchase_price: '1.50',
      selling_price: '3.75',
      default_reorder_level: 5,
      variants: [
        makeVariant('v2', 'Regular', 'CRO-01-REG', 0), // Out of stock (0)
      ],
      is_active: true,
    },
    {
      id: 'p3',
      name: 'Ceramic Mug',
      sku: 'MUG-01',
      category: catMerch,
      purchase_price: '6.00',
      selling_price: '18.00',
      default_reorder_level: 5,
      variants: [
        makeVariant('v3', 'Blue', 'MUG-01-BLU', 15, '18.00', [{ id: 'av1', value_name: 'Blue' }]),
        makeVariant('v4', 'White', 'MUG-01-WHT', 25, '18.00', [{ id: 'av2', value_name: 'White' }]), // Total stock = 40 (In stock), Variable product
      ],
      is_active: true,
    },
    {
      id: 'p4',
      name: 'Seasonal Pumpkin Spice',
      sku: 'PSP-01',
      category: catCoffee,
      purchase_price: '5.00',
      selling_price: '12.00',
      default_reorder_level: 5,
      variants: [
        makeVariant('v5', 'Default', 'PSP-01-DEF', 20),
      ],
      is_active: false, // Deactivated / Inactive
    },
  ]

  const getProductTotalStock = (p: Product): number => {
    if (p.variants && p.variants.length > 0) {
      return p.variants.reduce((sum, v) => sum + (Number(v.quantity_on_hand) || 0), 0)
    }
    if ((p as any).total_stock !== undefined) {
      return Number((p as any).total_stock) || 0
    }
    if ((p as any).quantity_on_hand !== undefined) {
      return Number((p as any).quantity_on_hand) || 0
    }
    return 0
  }

  const filterAndSortPosProducts = (
    products: Product[],
    params: {
      searchQuery?: string
      selectedCategory?: string
      statusFilter?: PosStatusOption
      stockFilter?: PosStockOption
      productTypeFilter?: PosProductTypeOption
      sortBy?: PosSortOption
    }
  ): Product[] => {
    const {
      searchQuery = '',
      selectedCategory = 'All',
      statusFilter = 'ACTIVE',
      stockFilter = 'ALL',
      productTypeFilter = 'ALL',
      sortBy = 'DEFAULT',
    } = params

    const q = searchQuery.toLowerCase().trim()

    const filtered = products.filter((p) => {
      // 1. Category
      const matchCat =
        selectedCategory === 'All' ||
        p.category?.name?.toLowerCase() === selectedCategory.toLowerCase()
      if (!matchCat) return false

      // 2. Status
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? p.is_active !== false : p.is_active === false)
      if (!matchStatus) return false

      // 3. Stock Level
      const totalStock = getProductTotalStock(p)
      if (stockFilter === 'IN_STOCK') {
        if (totalStock <= 0) return false
      } else if (stockFilter === 'LOW_STOCK') {
        const reorder = p.default_reorder_level ?? 5
        if (totalStock <= 0 || totalStock > reorder) return false
      } else if (stockFilter === 'OUT_OF_STOCK') {
        if (totalStock > 0) return false
      }

      // 4. Product Type
      const isVariable =
        Boolean(p.variants && p.variants.length > 1) ||
        Boolean(
          p.variants?.[0]?.attribute_values &&
            p.variants[0].attribute_values.length > 0
        )
      if (productTypeFilter === 'SIMPLE' && isVariable) return false
      if (productTypeFilter === 'VARIABLE' && !isVariable) return false

      // 5. Search
      if (!q) return true
      const matchName = p.name?.toLowerCase().includes(q)
      const matchSku = p.sku?.toLowerCase().includes(q)
      const matchBarcode = p.barcode?.toLowerCase().includes(q)
      const matchVariant = p.variants?.some(
        (v) =>
          v.sku?.toLowerCase().includes(q) ||
          v.name?.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q) ||
          v.attribute_values?.some((av) => av.value_name?.toLowerCase().includes(q))
      )
      return matchName || matchSku || matchBarcode || matchVariant
    })

    // 6. Sorting
    if (sortBy === 'NAME_ASC') {
      return [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    if (sortBy === 'NAME_DESC') {
      return [...filtered].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    }
    if (sortBy === 'PRICE_ASC') {
      const getPrice = (prod: Product) => {
        const val = prod.selling_price
        return typeof val === 'number' ? val : parseFloat(String(val || '0')) || 0
      }
      return [...filtered].sort((a, b) => getPrice(a) - getPrice(b))
    }
    if (sortBy === 'PRICE_DESC') {
      const getPrice = (prod: Product) => {
        const val = prod.selling_price
        return typeof val === 'number' ? val : parseFloat(String(val || '0')) || 0
      }
      return [...filtered].sort((a, b) => getPrice(b) - getPrice(a))
    }
    if (sortBy === 'STOCK_ASC') {
      return [...filtered].sort((a, b) => getProductTotalStock(a) - getProductTotalStock(b))
    }
    if (sortBy === 'STOCK_DESC') {
      return [...filtered].sort((a, b) => getProductTotalStock(b) - getProductTotalStock(a))
    }

    return filtered
  }

  const calculateActiveFiltersCount = (
    stockFilter: PosStockOption,
    statusFilter: PosStatusOption,
    productTypeFilter: PosProductTypeOption,
    sortBy: PosSortOption
  ): number => {
    let count = 0
    if (stockFilter !== 'ALL') count++
    if (statusFilter !== 'ACTIVE') count++
    if (productTypeFilter !== 'ALL') count++
    if (sortBy !== 'DEFAULT') count++
    return count
  }

  describe('Stock Level Filtering for POS', () => {
    it('returns all active products when stockFilter is ALL', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { stockFilter: 'ALL' })
      expect(res).toHaveLength(3) // p1, p2, p3 (p4 is inactive)
    })

    it('returns only in-stock items when stockFilter is IN_STOCK', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { stockFilter: 'IN_STOCK' })
      expect(res.map((p) => p.name)).toEqual(['Espresso Roast', 'Ceramic Mug'])
      expect(res.find((p) => p.name === 'Almond Croissant')).toBeUndefined()
    })

    it('returns only low stock items when stockFilter is LOW_STOCK', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { stockFilter: 'LOW_STOCK' })
      expect(res).toHaveLength(1)
      expect(res[0].name).toBe('Espresso Roast') // stock = 4 <= 10
    })

    it('returns only out of stock items when stockFilter is OUT_OF_STOCK', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { stockFilter: 'OUT_OF_STOCK' })
      expect(res).toHaveLength(1)
      expect(res[0].name).toBe('Almond Croissant') // stock = 0
    })
  })

  describe('Status Filtering for POS', () => {
    it('defaults to ACTIVE only in POS', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { statusFilter: 'ACTIVE' })
      expect(res.every((p) => p.is_active)).toBe(true)
      expect(res.find((p) => p.id === 'p4')).toBeUndefined()
    })

    it('includes deactivated products when statusFilter is ALL', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { statusFilter: 'ALL' })
      expect(res).toHaveLength(4)
      expect(res.find((p) => p.id === 'p4')).toBeDefined()
    })

    it('returns only deactivated products when statusFilter is DEACTIVATED', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { statusFilter: 'DEACTIVATED' })
      expect(res).toHaveLength(1)
      expect(res[0].name).toBe('Seasonal Pumpkin Spice')
    })
  })

  describe('Product Type Filtering for POS', () => {
    it('returns only simple products when productTypeFilter is SIMPLE', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { productTypeFilter: 'SIMPLE' })
      expect(res.map((p) => p.name)).toEqual(['Espresso Roast', 'Almond Croissant'])
      expect(res.find((p) => p.name === 'Ceramic Mug')).toBeUndefined()
    })

    it('returns only variable products when productTypeFilter is VARIABLE', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { productTypeFilter: 'VARIABLE' })
      expect(res).toHaveLength(1)
      expect(res[0].name).toBe('Ceramic Mug')
    })
  })

  describe('Category Filtering for POS', () => {
    it('filters products by selected category', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { selectedCategory: 'Bakery' })
      expect(res).toHaveLength(1)
      expect(res[0].name).toBe('Almond Croissant')
    })

    it('matches category case-insensitively', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { selectedCategory: 'coffee' })
      expect(res).toHaveLength(1)
      expect(res[0].name).toBe('Espresso Roast')
    })
  })

  describe('Sorting for POS', () => {
    it('sorts by Price: Low to High (PRICE_ASC)', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { sortBy: 'PRICE_ASC' })
      expect(res.map((p) => p.name)).toEqual(['Almond Croissant', 'Espresso Roast', 'Ceramic Mug'])
      expect(res.map((p) => p.selling_price)).toEqual(['3.75', '8.50', '18.00'])
    })

    it('sorts by Price: High to Low (PRICE_DESC)', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { sortBy: 'PRICE_DESC' })
      expect(res.map((p) => p.name)).toEqual(['Ceramic Mug', 'Espresso Roast', 'Almond Croissant'])
      expect(res.map((p) => p.selling_price)).toEqual(['18.00', '8.50', '3.75'])
    })

    it('sorts by Name: A to Z (NAME_ASC)', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { sortBy: 'NAME_ASC' })
      expect(res.map((p) => p.name)).toEqual(['Almond Croissant', 'Ceramic Mug', 'Espresso Roast'])
    })

    it('sorts by Name: Z to A (NAME_DESC)', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { sortBy: 'NAME_DESC' })
      expect(res.map((p) => p.name)).toEqual(['Espresso Roast', 'Ceramic Mug', 'Almond Croissant'])
    })

    it('sorts by Stock: Low to High (STOCK_ASC)', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { sortBy: 'STOCK_ASC' })
      expect(res.map((p) => p.name)).toEqual(['Almond Croissant', 'Espresso Roast', 'Ceramic Mug'])
      expect(res.map(getProductTotalStock)).toEqual([0, 4, 40])
    })

    it('sorts by Stock: High to Low (STOCK_DESC)', () => {
      const res = filterAndSortPosProducts(samplePosProducts, { sortBy: 'STOCK_DESC' })
      expect(res.map((p) => p.name)).toEqual(['Ceramic Mug', 'Espresso Roast', 'Almond Croissant'])
      expect(res.map(getProductTotalStock)).toEqual([40, 4, 0])
    })
  })

  describe('Active Filters Count & Reset', () => {
    it('returns 0 when all filters are at defaults', () => {
      const count = calculateActiveFiltersCount('ALL', 'ACTIVE', 'ALL', 'DEFAULT')
      expect(count).toBe(0)
    })

    it('increments for each non-default filter', () => {
      const count = calculateActiveFiltersCount('IN_STOCK', 'DEACTIVATED', 'SIMPLE', 'PRICE_ASC')
      expect(count).toBe(4)
    })

    it('correctly tracks partial non-default filters', () => {
      const count = calculateActiveFiltersCount('LOW_STOCK', 'ACTIVE', 'ALL', 'NAME_ASC')
      expect(count).toBe(2)
    })
  })

  describe('Combined Multi-Criteria Search & Filter', () => {
    it('combines search query with in-stock filter and price sort', () => {
      const res = filterAndSortPosProducts(samplePosProducts, {
        searchQuery: 'o',
        stockFilter: 'IN_STOCK',
        sortBy: 'PRICE_DESC',
      })
      // 'Espresso Roast' (has 'o', in-stock, $8.50)
      // 'Almond Croissant' (has 'o', but OUT of stock -> filtered out)
      expect(res.map((p) => p.name)).toEqual(['Espresso Roast'])
    })
  })
})
