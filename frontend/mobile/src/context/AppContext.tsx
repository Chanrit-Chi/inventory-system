import React, { createContext, useContext, ReactNode } from 'react';
import type { Order } from '../types';

export interface AppContextType {
  onNavigate: (tab: any) => void;
  onOpenScanner: () => void;
  onOpenStockIn: (product?: any, variant?: any) => void;
  onOpenStockAdjustment: (product?: any, variant?: any) => void;
  onOpenPurchaseOrder: (opts?: { mode?: 'list' | 'create'; supplierId?: string }) => void;
  onOpenPurchaseOrders?: () => void;
  productsSubTab?: 'catalog' | 'movements' | 'purchaseOrders';
  setProductsSubTab?: (tab: 'catalog' | 'movements' | 'purchaseOrders') => void;
  onSelectOrder: (order: Order) => void;
  onConvertQuoteToCart: (quoteItems: any[], quoteNumber?: string, preset?: any) => void;
  onCheckoutStateChange: (isActive: boolean) => void;
  onAuthModalOpen: () => void;
  onSelectCustomerForPOS?: (customer: any) => void;
  cartHook: any;
  offlineQueueHook: any;
  purchaseOrders: any[];
  addPurchaseOrder: any;
  markPoReceived: any;
  currentUser: any;
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
