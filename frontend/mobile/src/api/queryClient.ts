import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient, onlineManager } from '@tanstack/react-query'

// Wire up NetInfo with TanStack Query onlineManager for automatic reconnection
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && (state.isInternetReachable !== false))
    setOnline(isOnline)
  })
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes stale time
      gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection / persistence time
      refetchOnWindowFocus: false, // Window focus is handled via AppState or navigation listeners
      refetchOnReconnect: true,
      retry: (failureCount, error: any) => {
        // Do not retry 4xx client errors (e.g. 401, 403, 404, 422)
        const status = error?.response?.status || error?.status
        if (status && status >= 400 && status < 500) {
          return false
        }
        // Retry network drops or 5xx server errors up to 2 times
        return failureCount < 2
      },
    },
    mutations: {
      retry: 0, // Handle offline queuing explicitly via useOfflineQueue
    },
  },
})

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'INVENTORY_QUERY_CACHE_V1',
  throttleTime: 1000,
})
