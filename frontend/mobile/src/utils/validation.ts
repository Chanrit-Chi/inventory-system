import { z } from 'zod'

// Phone numbers must be at least 8 characters and only digits
export const phoneSchema = z
  .string()
  .min(1, { message: 'Phone number is required' })
  .min(8, { message: 'Phone number must be at least 8 digits' })
  .regex(/^\d+$/, { message: 'Phone number can only contain digits' })

// Names must not be empty
export const nameSchema = z
  .string()
  .min(1, { message: 'Name is required' })
  .max(100, { message: 'Name is too long' })

export const emailSchema = z
  .string()
  .email({ message: 'Invalid email address' })
  .optional()
  .or(z.literal(''))

export const addressSchema = z
  .string()
  .max(255, { message: 'Address is too long' })
  .optional()
  .or(z.literal(''))

// Base Customer Schema
export const customerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  address: addressSchema,
  preferred_delivery_company: z.string().optional().or(z.literal('')),
})

export type CustomerFormValues = z.infer<typeof customerSchema>

export const adminUserSchema = z.object({
  name: nameSchema,
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER']),
  department: z.string().optional().or(z.literal('')),
  hire_date: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  base_salary: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Base salary must be a valid non-negative amount ($0.00+)'
    ),
  salary_reason: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
})
export type AdminUserFormValues = z.infer<typeof adminUserSchema>

export const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountName: z.string().min(1, 'Account name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  currency: z.enum(['USD', 'KHR', 'Dual']),
  isActive: z.boolean().default(true),
})
export type BankAccountFormValues = z.infer<typeof bankAccountSchema>

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  code: z.string().min(1, 'Category code is required'),
  description: z.string().optional().or(z.literal('')),
})
export type CategoryFormValues = z.infer<typeof categorySchema>

export const attributeSchema = z.object({
  name: z.string().min(1, 'Attribute name is required'),
  code: z.string().optional().or(z.literal('')),
  values: z.string().min(1, 'At least one value is required (comma separated)'),
})
export type AttributeFormValues = z.infer<typeof attributeSchema>

export const deliveryCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  phone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
})
export type DeliveryCompanyFormValues = z.infer<typeof deliveryCompanySchema>

export const deliveryZoneSchema = z.object({
  name: z.string().min(1, 'Zone name is required'),
  cost: z.string().min(1, 'Cost is required').regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid number'),
  isActive: z.boolean().default(true),
})
export type DeliveryZoneFormValues = z.infer<typeof deliveryZoneSchema>

export const expenseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.enum(['Rent', 'Utilities', 'Salary', 'Logistics', 'Marketing', 'Supplies', 'Maintenance', 'Other']),
  amount: z.string().min(1, 'Amount is required').regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  paymentMethod: z.enum(['Cash', 'ABA QR', 'Card', 'Bank Transfer']),
  notes: z.string().optional().or(z.literal('')),
})
export type ExpenseFormValues = z.infer<typeof expenseSchema>

export const salesChannelSchema = z.object({
  name: z.string().min(1, 'Channel name is required'),
  platform: z.string().default('pos'),
  code: z.string().optional().or(z.literal('')),
  type: z.string().optional().or(z.literal('')),
  imageUrl: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
})
export type SalesChannelFormValues = z.infer<typeof salesChannelSchema>

export const posCheckoutSchema = z.object({
  channelId: z.string().min(1, 'Sales channel is required'),
  customerName: z.string().min(1, 'Name is required'),
  customerPhone: z.string().min(1, 'Phone is required'),
  isDelivery: z.boolean().default(true),
  discountType: z.enum(['flat', 'percentage']).default('flat'),
  discountInput: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a valid number' }),
  taxType: z.enum(['flat', 'percentage']).default('flat'),
  taxInput: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a valid number' }),
  taxRate: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a valid number' }),
  orderStatus: z.enum(['paid', 'pending']).default('paid'),
  customDeliveryFee: z.string().optional().refine(val => !val || (!isNaN(Number(val)) && Number(val) >= 0), { message: 'Custom delivery fee must be a valid positive amount ($0.00+)' }),
  deliveryAddress: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  // Cap percentage discount at 100%
  if (data.discountType === 'percentage' && data.discountInput) {
    const val = Number(data.discountInput)
    if (!isNaN(val) && val > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage discount cannot exceed 100%',
        path: ['discountInput'],
      })
    }
  }
  // Address is strictly required when delivery is selected
  if (data.isDelivery) {
    if (!data.deliveryAddress || data.deliveryAddress.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Delivery address is required (minimum 3 characters)',
        path: ['deliveryAddress'],
      })
    }
  }
  // Custom delivery fee validation
  if (data.customDeliveryFee !== undefined && data.customDeliveryFee !== '') {
    const feeNum = Number(data.customDeliveryFee)
    if (isNaN(feeNum) || feeNum < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom delivery fee must be a valid positive amount ($0.00+)',
        path: ['customDeliveryFee'],
      })
    }
  }
})
export type PosCheckoutFormValues = z.infer<typeof posCheckoutSchema>

export const productVariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional().default('Standard'),
  sku: z.string().optional().default(''),
  barcode: z.string().optional().nullable().transform((v) => v || ''),
  stock: z.coerce.number().min(0, 'Stock cannot be negative').default(0),
  priceOverride: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v !== null && v !== undefined ? String(v) : '')),
  costOverride: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v !== null && v !== undefined ? String(v) : '')),
  attribute_values: z.any().array().optional().default([]),
})

export const productAttributeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Attribute name is required'),
  valuesText: z.string().optional().default(''),
})

export const productSchema = z.object({
  productType: z.enum(['SIMPLE', 'VARIABLE']).default('SIMPLE'),
  name: z.string().min(1, 'Product name is required'),
  category: z.string().optional().default('Apparel'),
  purchase_price: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v !== null && v !== undefined ? String(v) : '')),
  selling_price: z.union([z.string(), z.number()]).transform((v) => String(v || '')).refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, { message: 'Valid selling price is required' }),
  default_reorder_level: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v !== null && v !== undefined ? String(v) : '10')),
  is_active: z.coerce.boolean().default(true),
  image_url: z.string().optional().nullable().default(''),
  
  // Simple fields
  simpleSku: z.string().optional().default(''),
  simpleBarcode: z.string().optional().nullable().default(''),
  simpleStock: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v !== null && v !== undefined ? String(v) : '0')),
  
  // Variable fields
  attributesList: z.array(productAttributeSchema).optional().default([]),
  variantsList: z.array(productVariantSchema).optional().default([]),
})

export type ProductFormValues = z.infer<typeof productSchema>

export const quotationItemSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  productName: z.string().min(1, 'Product Name is required'),
  sku: z.string(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit Price must be at least 0'),
  lineTotal: z.coerce.number(),
})

export const quotationSchema = z.object({
  customerName: z.string().min(1, 'Customer Name is required'),
  customerPhone: z.string().min(1, 'Customer Phone is required'),
  notes: z.string().optional().or(z.literal('')),
  discount: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a valid number' }),
  items: z.array(quotationItemSchema).min(1, 'At least one item is required'),
})

export type QuotationFormValues = z.infer<typeof quotationSchema>

export const invoiceItemSchema = z.object({
  id: z.string(),
  productName: z.string().min(1, 'Product Name is required'),
  sku: z.string().optional().or(z.literal('')),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit Price must be at least 0'),
  totalPrice: z.coerce.number().optional(),
})

export const invoiceSchema = z.object({
  customerName: z.string().min(1, 'Customer Name is required'),
  customerPhone: z.string().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
})

export type InvoiceFormValues = z.infer<typeof invoiceSchema>


export const supplierSchema = z.object({
  name: nameSchema,
  contactPerson: z.string().optional().or(z.literal('')),
  phone: phoneSchema,
  email: emailSchema,
  address: addressSchema,
  leadTimeDays: z.coerce.number().optional().or(z.literal(0)),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>

export const stockAdjustmentSchema = z.object({
  variantId: z.string().min(1, 'Variant is required'),
  newQuantity: z.coerce.number().min(0, 'Quantity cannot be negative'),
  reason: z.enum(['CORRECTION', 'DAMAGED', 'RETURN', 'EXPIRED', 'RESTOCK', 'OTHER']),
  notes: z.string().optional().or(z.literal('')),
})
export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>

export const stockInSchema = z.object({
  variantId: z.string().min(1, 'Variant is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  purchasePrice: z.coerce.number().min(0, 'Purchase price cannot be negative').optional(),
  supplierId: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})
export type StockInFormValues = z.infer<typeof stockInSchema>

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  expectedDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1, 'Variant is required'),
        quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
        costPrice: z.coerce.number().min(0, 'Cost must be non-negative'),
      })
    )
    .min(1, 'At least one item is required'),
})
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>


