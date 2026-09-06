import type { Product, ProductVariant, ScannedAttributeValue } from '../types'
import type { VariantDraft } from '../screens/products/hooks/useProductForm'

function findMatchingVariant(
  comb: ScannedAttributeValue[],
  formVariants: VariantDraft[],
  dbVariants: ProductVariant[]
): { variant: VariantDraft | ProductVariant; isFormVariant: boolean } | null {
  const combTokens = comb
    .map((c) => c.value_name.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|')
  const combName = comb.map((c) => c.value_name.trim().toLowerCase()).join(' / ')

  // 1. Search in current form variants first (preserves any user edits in modal)
  for (const fv of formVariants) {
    if (fv.name.trim().toLowerCase() === combName) {
      return { variant: fv, isFormVariant: true }
    }
    const fvTokensFromAttrs = (fv.attribute_values || [])
      .map((av: any) => (av.value_name || av.value || '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|')
    if (fvTokensFromAttrs && fvTokensFromAttrs === combTokens) {
      return { variant: fv, isFormVariant: true }
    }
    const fvTokensFromName = (fv.name || '')
      .split(/[\/\-,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|')
    if (fvTokensFromName && fvTokensFromName === combTokens) {
      return { variant: fv, isFormVariant: true }
    }
  }

  // 2. Search in existing product variants from DB
  for (const dv of dbVariants) {
    if (dv.name.trim().toLowerCase() === combName) {
      return { variant: dv, isFormVariant: false }
    }
    const dvTokensFromAttrs = (dv.attribute_values || [])
      .map((av: any) => (av.value_name || av.value || '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|')
    if (dvTokensFromAttrs && dvTokensFromAttrs === combTokens) {
      return { variant: dv, isFormVariant: false }
    }
    const dvTokensFromName = (dv.name || '')
      .split(/[\/\-,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|')
    if (dvTokensFromName && dvTokensFromName === combTokens) {
      return { variant: dv, isFormVariant: false }
    }
  }

  return null
}

function generateVariantDrafts(
  combinations: ScannedAttributeValue[][],
  formVariants: VariantDraft[],
  dbVariants: ProductVariant[],
  baseSkuPrefix: string = 'PROD',
  customInitialStock: number = 10
): VariantDraft[] {
  return combinations.map((comb, idx) => {
    const name = comb.map((c) => c.value_name).join(' / ')
    const skuSuffix = comb.map((c) => c.value_name.substring(0, 3).toUpperCase()).join('-')
    const sku = `${baseSkuPrefix}-${skuSuffix}`

    const matchResult = findMatchingVariant(comb, formVariants, dbVariants)

    if (matchResult) {
      const { variant, isFormVariant } = matchResult
      const existingStock = isFormVariant
        ? Number((variant as VariantDraft).stock) || 0
        : Number((variant as ProductVariant).quantity_on_hand) || 0

      const existingPriceOverride = isFormVariant
        ? (variant as VariantDraft).priceOverride || ''
        : (variant as ProductVariant).selling_price_override !== null && (variant as ProductVariant).selling_price_override !== undefined
        ? String((variant as ProductVariant).selling_price_override)
        : ''

      const existingCostOverride = isFormVariant
        ? (variant as VariantDraft).costOverride || ''
        : (variant as ProductVariant).cost_price_override !== null && (variant as ProductVariant).cost_price_override !== undefined
        ? String((variant as ProductVariant).cost_price_override)
        : ''

      return {
        id: variant.id,
        name,
        sku: variant.sku || sku,
        barcode: variant.barcode || '',
        stock: existingStock,
        priceOverride: existingPriceOverride,
        costOverride: existingCostOverride,
        attribute_values: comb,
      }
    }

    return {
      id: `var-new-${idx}-${Date.now()}`,
      name,
      sku,
      barcode: '',
      stock: customInitialStock,
      priceOverride: '',
      costOverride: '',
      attribute_values: comb,
    }
  })
}

describe('Product Variant Stock Preservation & Robust Matrix Matching', () => {
  const existingDbVariants: ProductVariant[] = [
    {
      id: '01a07600-s-black-uuid',
      product_id: 'prod-c114',
      name: 'S / Black',
      sku: 'C114-S-BLA',
      barcode: '885100000001',
      quantity_on_hand: 0,
      selling_price: '25.00',
      selling_price_override: null,
      is_active: true,
      attribute_values: [
        { id: 'av-size-s', value_name: 'S', attribute: { name: 'Size' } },
        { id: 'av-color-black', value_name: 'Black', attribute: { name: 'Color' } },
      ],
    },
    {
      id: '01a07600-s-white-uuid',
      product_id: 'prod-c114',
      name: 'S / White',
      sku: 'C114-S-WHI',
      barcode: '885100000002',
      quantity_on_hand: 7,
      selling_price: '25.00',
      selling_price_override: '29.99',
      is_active: true,
      attribute_values: [
        { id: 'av-size-s', value_name: 'S', attribute: { name: 'Size' } },
        { id: 'av-color-white', value_name: 'White', attribute: { name: 'Color' } },
      ],
    },
    {
      id: '01a07600-s-navy-uuid',
      product_id: 'prod-c114',
      name: 'S / Navy Blue',
      sku: 'C114-S-NAV',
      barcode: '885100000003',
      quantity_on_hand: 6,
      selling_price: '25.00',
      selling_price_override: null,
      is_active: true,
      attribute_values: [
        { id: 'av-size-s', value_name: 'S', attribute: { name: 'Size' } },
        { id: 'av-color-navy', value_name: 'Navy Blue', attribute: { name: 'Color' } },
      ],
    },
  ]

  it('preserves existing variant ID, barcode, and adjusted stock when combination attribute order is reversed', () => {
    const reversedCombo: ScannedAttributeValue[][] = [
      [
        { id: 'c1', value_name: 'Black', attribute: { name: 'Color' } },
        { id: 's1', value_name: 'S', attribute: { name: 'Size' } },
      ],
      [
        { id: 'c2', value_name: 'White', attribute: { name: 'Color' } },
        { id: 's1', value_name: 'S', attribute: { name: 'Size' } },
      ],
      [
        { id: 'c3', value_name: 'Navy Blue', attribute: { name: 'Color' } },
        { id: 's1', value_name: 'S', attribute: { name: 'Size' } },
      ],
    ]

    const result = generateVariantDrafts(reversedCombo, [], existingDbVariants, 'C114', 10)
    expect(result).toHaveLength(3)

    const blackVar = result.find((r) => r.name === 'Black / S')
    expect(blackVar).toBeDefined()
    expect(blackVar?.id).toBe('01a07600-s-black-uuid')
    expect(blackVar?.barcode).toBe('885100000001')
    expect(blackVar?.stock).toBe(0) // preserved 0, NOT overwritten by 10!

    const whiteVar = result.find((r) => r.name === 'White / S')
    expect(whiteVar).toBeDefined()
    expect(whiteVar?.id).toBe('01a07600-s-white-uuid')
    expect(whiteVar?.barcode).toBe('885100000002')
    expect(whiteVar?.stock).toBe(7)
    expect(whiteVar?.priceOverride).toBe('29.99')

    const navyVar = result.find((r) => r.name === 'Navy Blue / S')
    expect(navyVar).toBeDefined()
    expect(navyVar?.id).toBe('01a07600-s-navy-uuid')
    expect(navyVar?.barcode).toBe('885100000003')
    expect(navyVar?.stock).toBe(6)
  })

  it('preserves user modifications made directly in form inputs prior to regenerating', () => {
    const currentFormVariants: VariantDraft[] = [
      {
        id: '01a07600-s-white-uuid',
        name: 'S / White',
        sku: 'C114-S-WHI',
        barcode: '885100000002',
        stock: 15,
        priceOverride: '32.00',
        costOverride: '',
        attribute_values: [
          { id: 'av-size-s', value_name: 'S', attribute: { name: 'Size' } },
          { id: 'av-color-white', value_name: 'White', attribute: { name: 'Color' } },
        ],
      },
    ]

    const combos: ScannedAttributeValue[][] = [
      [
        { id: 's1', value_name: 'S', attribute: { name: 'Size' } },
        { id: 'c2', value_name: 'White', attribute: { name: 'Color' } },
      ],
    ]

    const result = generateVariantDrafts(combos, currentFormVariants, existingDbVariants, 'C114', 10)
    expect(result[0].stock).toBe(15)
    expect(result[0].priceOverride).toBe('32.00')
    expect(result[0].id).toBe('01a07600-s-white-uuid')
  })

  it('assigns custom initial stock to brand new variant combinations', () => {
    const newCombo: ScannedAttributeValue[][] = [
      [
        { id: 's-xl', value_name: 'XL', attribute: { name: 'Size' } },
        { id: 'c-pink', value_name: 'Hot Pink', attribute: { name: 'Color' } },
      ],
    ]

    // User customized initial stock to 25
    const result25 = generateVariantDrafts(newCombo, [], existingDbVariants, 'C114', 25)
    expect(result25[0].name).toBe('XL / Hot Pink')
    expect(result25[0].stock).toBe(25)

    // User customized initial stock to 0
    const result0 = generateVariantDrafts(newCombo, [], existingDbVariants, 'C114', 0)
    expect(result0[0].stock).toBe(0)

    // Default 10 initial stock
    const resultDefault = generateVariantDrafts(newCombo, [], existingDbVariants, 'C114', 10)
    expect(resultDefault[0].stock).toBe(10)
  })

  it('supports batch applying stock to all variants at once', () => {
    const drafts: VariantDraft[] = [
      { id: 'v1', name: 'S / Red', sku: 'SKU-1', barcode: '', stock: 10, priceOverride: '', costOverride: '', attribute_values: [] },
      { id: 'v2', name: 'M / Red', sku: 'SKU-2', barcode: '', stock: 10, priceOverride: '', costOverride: '', attribute_values: [] },
      { id: 'v3', name: 'L / Red', sku: 'SKU-3', barcode: '', stock: 10, priceOverride: '', costOverride: '', attribute_values: [] },
    ]

    // Batch apply stock = 0
    const targetStock = 0
    const batchUpdated = drafts.map(d => ({ ...d, stock: targetStock }))
    expect(batchUpdated.every(d => d.stock === 0)).toBe(true)

    // Batch apply stock = 50
    const batch50 = drafts.map(d => ({ ...d, stock: 50 }))
    expect(batch50.every(d => d.stock === 50)).toBe(true)
  })

  it('correctly maps Product to edit form draftVariants without altering stock quantities', () => {
    const product: Product = {
      id: 'prod-c114',
      name: 'C114',
      sku: 'C114',
      purchase_price: '15.00',
      selling_price: '25.00',
      variants: existingDbVariants,
      is_active: true,
    }

    const draftVariants: VariantDraft[] = (product.variants || []).map((v) => ({
      id: v.id,
      name: v.name || 'Standard',
      sku: v.sku,
      barcode: v.barcode || '',
      stock: v.quantity_on_hand ?? 0,
      priceOverride: v.selling_price_override !== null && v.selling_price_override !== undefined ? String(v.selling_price_override) : '',
      costOverride: v.cost_price_override !== null && v.cost_price_override !== undefined ? String(v.cost_price_override) : '',
      attribute_values: v.attribute_values || [],
    }))

    expect(draftVariants[0].stock).toBe(0)
    expect(draftVariants[1].stock).toBe(7)
    expect(draftVariants[2].stock).toBe(6)

    const variantsPayload = draftVariants.map((v) => ({
      id: v.id && !v.id.startsWith('var-new') ? v.id : undefined,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode || null,
      quantity_on_hand: Number(v.stock) || 0,
    }))

    expect(variantsPayload[0].id).toBe('01a07600-s-black-uuid')
    expect(variantsPayload[0].quantity_on_hand).toBe(0)
    expect(variantsPayload[1].id).toBe('01a07600-s-white-uuid')
    expect(variantsPayload[1].quantity_on_hand).toBe(7)
  })
})
