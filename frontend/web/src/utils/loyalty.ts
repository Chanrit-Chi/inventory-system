export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type TitleCaseTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface CustomerLoyaltyInfo {
  tier: TitleCaseTier;
  tierColor: string;
  tierBg: string;
  tierBorder: string;
  totalSpent: number;
  totalPurchased: number;
  lastPurchaseDate?: string | null;
  points: number;
}

export const TIER_THRESHOLDS = {
  PLATINUM: { spent: 1000, orders: 20 },
  GOLD: { spent: 500, orders: 10 },
  SILVER: { spent: 200, orders: 3 },
};

export function getTier(spent: number, orders?: number): Tier {
  const o = orders ?? 0;
  if (spent >= TIER_THRESHOLDS.PLATINUM.spent || o >= TIER_THRESHOLDS.PLATINUM.orders) return 'PLATINUM';
  if (spent >= TIER_THRESHOLDS.GOLD.spent || o >= TIER_THRESHOLDS.GOLD.orders) return 'GOLD';
  if (spent >= TIER_THRESHOLDS.SILVER.spent || o >= TIER_THRESHOLDS.SILVER.orders) return 'SILVER';
  return 'BRONZE';
}

export interface TierDetails {
  tier: TitleCaseTier;
  variant: 'purple' | 'warning' | 'info' | 'neutral';
  bg: string;
  text: string;
  border: string;
  color: string;
  icon: string;
  label: string;
}

export function getTierDetails(tier: string | TitleCaseTier | Tier): TierDetails {
  const normalized = (tier || 'Bronze').toString().toLowerCase();
  switch (normalized) {
    case 'platinum':
      return {
        tier: 'Platinum' as TitleCaseTier,
        variant: 'purple',
        bg: 'bg-purple-bg',
        text: 'text-purple-text',
        border: 'border-purple-border',
        color: 'var(--color-purple)',
        icon: 'diamond',
        label: 'Platinum Tier',
      };
    case 'gold':
      return {
        tier: 'Gold' as TitleCaseTier,
        variant: 'warning',
        bg: 'bg-warning-bg',
        text: 'text-warning-text',
        border: 'border-warning-border',
        color: 'var(--color-warning)',
        icon: 'ribbon',
        label: 'Gold Tier',
      };
    case 'silver':
      return {
        tier: 'Silver' as TitleCaseTier,
        variant: 'info',
        bg: 'bg-info-bg',
        text: 'text-info-text',
        border: 'border-info-border',
        color: 'var(--color-info)',
        icon: 'medal',
        label: 'Silver Tier',
      };
    case 'bronze':
    default:
      return {
        tier: 'Bronze' as TitleCaseTier,
        variant: 'neutral',
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        border: 'border-border',
        color: 'var(--color-muted-foreground)',
        icon: 'star',
        label: 'Bronze Tier',
      };
  }
}

export function calculateLoyalty(customer?: {
  loyalty_tier?: string | null;
  total_spent?: number | string | null;
  total_purchased?: number | null;
  total_orders?: number | null;
  last_purchase_at?: string | null;
  [key: string]: any;
} | null): CustomerLoyaltyInfo {
  if (!customer) {
    const styling = getTierDetails('Bronze');
    return {
      tier: 'Bronze',
      tierColor: styling.color,
      tierBg: styling.bg,
      tierBorder: styling.border,
      totalSpent: 0,
      totalPurchased: 0,
      points: 0,
    };
  }

  const explicitTier = customer.loyalty_tier;
  const spent = typeof customer.total_spent === 'number'
    ? customer.total_spent
    : parseFloat(String(customer.total_spent || '0')) || 0;
  const orders = customer.total_purchased ?? customer.total_orders ?? 0;

  const tierEnum = explicitTier ? explicitTier.toUpperCase() : getTier(spent, orders);
  const titleCaseTier = (tierEnum.charAt(0).toUpperCase() + tierEnum.slice(1).toLowerCase()) as TitleCaseTier;
  const styling = getTierDetails(titleCaseTier);

  return {
    tier: titleCaseTier,
    tierColor: styling.color,
    tierBg: styling.bg,
    tierBorder: styling.border,
    totalSpent: spent,
    totalPurchased: orders,
    lastPurchaseDate: customer.last_purchase_at,
    points: Math.floor(spent),
  };
}