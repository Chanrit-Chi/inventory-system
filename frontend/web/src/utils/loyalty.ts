export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export function getTier(spent: number, orders?: number): Tier {
  const o = orders ?? 0
  if (spent >= 1000 || o >= 20) return 'PLATINUM'
  if (spent >= 500  || o >= 10) return 'GOLD'
  if (spent >= 200  || o >= 3)  return 'SILVER'
  return 'BRONZE'
}