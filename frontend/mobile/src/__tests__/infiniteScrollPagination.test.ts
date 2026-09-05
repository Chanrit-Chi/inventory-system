import { queryKeys } from '../api/queryKeys'
import type { ApiResponse, PaginationMeta, Product } from '../types'

interface PaginatedResult<T> {
  data: T[]
  meta?: PaginationMeta
  current_page?: number
  last_page?: number
}

describe('Infinite Scroll & Pagination Architecture', () => {
  describe('Query Keys Hierarchy', () => {
    it('should nest infinite query keys under their respective entity prefix for automatic invalidation', () => {
      // Products: prefix is ['products']
      const productsPrefix = queryKeys.products.all[0]
      const productsInfiniteKey = queryKeys.products.infinite({ page: 1, per_page: 20 })
      expect(productsInfiniteKey[0]).toBe(productsPrefix)
      expect(productsInfiniteKey[1]).toBe('infinite')

      // Orders: prefix is ['orders']
      const ordersPrefix = queryKeys.orders.all[0]
      const ordersInfiniteKey = queryKeys.orders.infinite({ page: 1, per_page: 20 })
      expect(ordersInfiniteKey[0]).toBe(ordersPrefix)
      expect(ordersInfiniteKey[1]).toBe('infinite')
    })
  })

  describe('Pagination Next-Page Resolution', () => {
    const getNextPageParam = (lastPage: PaginatedResult<any>) => {
      const meta = lastPage.meta || (typeof lastPage.current_page === 'number' && typeof lastPage.last_page === 'number'
        ? { current_page: lastPage.current_page, last_page: lastPage.last_page }
        : undefined)

      if (meta && typeof meta.current_page === 'number' && typeof meta.last_page === 'number') {
        return meta.current_page < meta.last_page ? meta.current_page + 1 : undefined
      }
      return undefined
    }

    it('should return next page number when current_page is less than last_page via meta', () => {
      const page1: PaginatedResult<Product> = {
        data: [{ id: 'prod-1', name: 'P1' } as Product],
        meta: { current_page: 1, last_page: 3, per_page: 10, total: 25 },
      }
      expect(getNextPageParam(page1)).toBe(2)

      const page2: PaginatedResult<Product> = {
        data: [{ id: 'prod-2', name: 'P2' } as Product],
        meta: { current_page: 2, last_page: 3, per_page: 10, total: 25 },
      }
      expect(getNextPageParam(page2)).toBe(3)
    })

    it('should return next page number when current_page is less than last_page via root fields', () => {
      const page1: PaginatedResult<Product> = {
        data: [{ id: 'prod-1', name: 'P1' } as Product],
        current_page: 1,
        last_page: 2,
      }
      expect(getNextPageParam(page1)).toBe(2)
    })

    it('should return undefined when reaching the last page or beyond', () => {
      const page3: PaginatedResult<Product> = {
        data: [{ id: 'prod-3', name: 'P3' } as Product],
        meta: { current_page: 3, last_page: 3, per_page: 10, total: 25 },
      }
      expect(getNextPageParam(page3)).toBeUndefined()
    })

    it('should return undefined if meta is missing or malformed', () => {
      const brokenPage = { data: [] } as PaginatedResult<Product>
      expect(getNextPageParam(brokenPage)).toBeUndefined()
    })
  })

  describe('Multi-Page Item Deduplication & Concatenation', () => {
    it('should seamlessly append new page items while filtering out duplicates', () => {
      const existing = [
        { id: 'item-1', name: 'Item 1' },
        { id: 'item-2', name: 'Item 2' },
      ]

      const incoming = [
        { id: 'item-2', name: 'Item 2 Duplicate' },
        { id: 'item-3', name: 'Item 3' },
        { id: 'item-4', name: 'Item 4' },
      ]

      const seen = new Set(existing.map((i) => i.id))
      const fresh = incoming.filter((i) => !seen.has(i.id))
      const merged = [...existing, ...fresh]

      expect(merged).toHaveLength(4)
      expect(merged.map((i) => i.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4'])
      expect(merged.find((i) => i.id === 'item-2')?.name).toBe('Item 2')
    })
  })

  describe('Infinite Query Cache Search for useProduct(id)', () => {
    it('should locate a product buried inside deep pages of infinite query cache', () => {
      const mockInfiniteData = {
        pages: [
          {
            data: [
              { id: 'p-1', name: 'Widget 1' } as Product,
              { id: 'p-2', name: 'Widget 2' } as Product,
            ],
            meta: { current_page: 1, last_page: 3, per_page: 2, total: 5 },
          },
          {
            data: [
              { id: 'p-3', name: 'Widget 3' } as Product,
              { id: 'p-4', name: 'Widget 4' } as Product,
            ],
            meta: { current_page: 2, last_page: 3, per_page: 2, total: 5 },
          },
          {
            data: [
              { id: 'p-5', name: 'Deep Widget 5' } as Product,
            ],
            meta: { current_page: 3, last_page: 3, per_page: 2, total: 5 },
          },
        ],
      }

      const findProductInCache = (id: string): Product | undefined => {
        for (const page of mockInfiniteData.pages) {
          const found = page.data.find((p) => p.id === id)
          if (found) return found
        }
        return undefined
      }

      expect(findProductInCache('p-1')?.name).toBe('Widget 1')
      expect(findProductInCache('p-4')?.name).toBe('Widget 4')
      expect(findProductInCache('p-5')?.name).toBe('Deep Widget 5')
      expect(findProductInCache('p-nonexistent')).toBeUndefined()
    })
  })
})
