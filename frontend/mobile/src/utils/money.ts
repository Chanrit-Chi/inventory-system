/**
 * Round a number to 2 decimal places using banker's rounding.
 * Used across POS financial calculations to match backend precision.
 */
export const round2 = (n: number): number => Math.round(n * 100) / 100
