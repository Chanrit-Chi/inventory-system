import { useState, useCallback, useRef } from 'react'
import { fetchStockMovements } from '../../../api/endpoints'
import type { StockMovementRecord } from '../../../types'

export function useStockMovements() {
  const [movements, setMovements]                       = useState<StockMovementRecord[]>([])
  const [movementsLoading, setMovementsLoading]         = useState(false)
  const [movementsLoadingMore, setMovementsLoadingMore] = useState(false)
  const [movementsCursor, setMovementsCursor]           = useState<string | null>(null)
  const [movementsHasMore, setMovementsHasMore]         = useState(true)

  const loadingRef = useRef(false)
  const loadingMoreRef = useRef(false)

  /** Fetches (or re-fetches from page 1) the stock movements list. */
  const loadMovements = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setMovementsLoading(true)
    try {
      const res = await fetchStockMovements({ per_page: 30 })
      const uniqueItems: StockMovementRecord[] = []
      const seen = new Set<string>()
      ;(res.data || []).forEach((item) => {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          uniqueItems.push(item)
        }
      })
      setMovements(uniqueItems)
      setMovementsCursor(res.next_cursor)
      setMovementsHasMore(res.has_more)
    } catch { /* silent */ }
    finally {
      setMovementsLoading(false)
      loadingRef.current = false
    }
  }, [])

  /** Appends the next cursor page — called by FlatList onEndReached. */
  const loadMoreMovements = useCallback(async () => {
    if (loadingMoreRef.current || loadingRef.current || !movementsHasMore || !movementsCursor) return
    loadingMoreRef.current = true
    setMovementsLoadingMore(true)
    try {
      const res = await fetchStockMovements({ cursor: movementsCursor, per_page: 30 })
      setMovements((prev) => {
        const seen = new Set(prev.map((m) => m.id))
        const fresh = (res.data || []).filter((m) => !seen.has(m.id))
        return [...prev, ...fresh]
      })
      setMovementsCursor(res.next_cursor)
      setMovementsHasMore(res.has_more)
    } catch { /* silent */ }
    finally {
      setMovementsLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [movementsHasMore, movementsCursor])

  return {
    movements,
    movementsLoading,
    movementsLoadingMore,
    movementsHasMore,
    loadMovements,
    loadMoreMovements,
  }
}
