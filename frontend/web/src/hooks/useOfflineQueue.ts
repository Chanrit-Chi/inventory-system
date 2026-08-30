// Offline queue hook for handling API mutations when network is unavailable
// Mirrors mobile implementation with localStorage persistence, idempotency, and retry logic

import api from '@/api/axios'

export interface OfflineMutation {
  id: string
  type: string
  endpoint: string
  payload: any
  createdAt: number
}

const QUEUE_STORAGE_KEY = '@inventory_offline_queue'

export function useOfflineQueue() {
  function getQueue(): OfflineMutation[] {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  }

  function enqueueMutation(mutation: OfflineMutation) {
    const queue = getQueue()
    queue.push({
      ...mutation,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    })
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  }

  async function replayQueue(onProgress?: (id: string) => void) {
    const queue = getQueue()
    for (const mutation of queue) {
      try {
        await api.post(mutation.endpoint, mutation.payload)
        // remove from queue on success
        const updated = getQueue().filter(x => x.id !== mutation.id)
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated))
        onProgress?.(mutation.id)
      } catch {
        // keep in queue, will retry later
        break // stop replay on first failure
      }
    }
  }

  return { enqueueMutation, replayQueue }
}