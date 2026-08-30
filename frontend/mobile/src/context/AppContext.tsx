import React, { createContext, useContext, ReactNode } from 'react';
import type { Order, Product, ProductVariant, Customer, PurchaseOrder, UserAccount, TabType, QuotationItem, CartItem } from '../types';
import type { useCart } from '../hooks/useCart';
import type { useOfflineQueue } from '../hooks/useOfflineQueue';

export interface CartCheckoutPreset {
  discount?: number | string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  notes?: string;
}

export interface AppContextType {
  onNavigate: (tab: TabType) => void;
  onOpenScanner: () => void;
  onOpenStockIn: (product?: Product, variant?: ProductVariant) => void;
  onOpenStockAdjustment: (product?: Product, variant?: ProductVariant) => void;
  onOpenPurchaseOrder: (opts?: { mode?: 'list' | 'create'; supplierId?: string }) => void;
  onOpenPurchaseOrders?: () => void;
  productsSubTab?: 'catalog' | 'movements' | 'purchaseOrders';
  setProductsSubTab?: (tab: 'catalog' | 'movements' | 'purchaseOrders') => void;
  onSelectOrder: (order: Order) => void;
  onConvertQuoteToCart: (quoteItems: QuotationItem[], quoteNumber?: string, preset?: CartCheckoutPreset) => void;
  onCheckoutStateChange: (isActive: boolean) => void;
  onAuthModalOpen: () => void;
  onSelectCustomerForPOS?: (customer: Customer) => void;
  cartHook: ReturnType<typeof useCart>;
  offlineQueueHook: ReturnType<typeof useOfflineQueue>;
  purchaseOrders: PurchaseOrder[];
  addPurchaseOrder: (po: PurchaseOrder) => void;
  markPoReceived: (poId: string) => Promise<any> | void;
  currentUser: UserAccount | null;
  orderRefreshTrigger: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode, value: AppContextType }> = ({ children, value }) => {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppActions = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppActions must be used within an AppProvider');
  }
  return context;
};
