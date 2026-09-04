import { cva, type VariantProps } from 'class-variance-authority'

/**
 * shadcn-vue Button Variants — OmniPOS Design Tokens
 * Adheres to:
 * - Brand Primary: Deep Amber (#924C00)
 * - Retail CTA: Vibrant Orange (#FF8800)
 * - Elevated Surfaces & Subtle Borders
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
    'transition-colors transition-shadow duration-150 ease-out whitespace-nowrap select-none leading-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
    'disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-cta text-white dark:text-neutral-950 font-semibold hover:bg-cta-hover active:bg-cta-active focus-visible:ring-cta shadow-sm shadow-cta/20',
        cta:
          'bg-cta text-white dark:text-neutral-950 font-semibold hover:bg-cta-hover active:bg-cta-active focus-visible:ring-cta shadow-sm shadow-cta/20',
        amber:
          'bg-primary text-white dark:text-neutral-950 shadow-xs hover:bg-primary-hover active:bg-primary-active focus-visible:ring-primary font-semibold',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-[#9A1414] active:bg-[#7D0F0F] focus-visible:ring-destructive font-semibold',
        success:
          'bg-[#047857] text-white shadow-xs hover:bg-[#065F46] active:bg-[#064E3B] focus-visible:ring-success font-semibold',
        secondary:
          'bg-card text-foreground border border-border shadow-xs hover:bg-muted hover:border-border-strong',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-muted hover:border-border-strong',
        ghost:
          'bg-transparent text-foreground hover:bg-muted hover:text-foreground',
        subtle:
          'bg-muted text-secondary-foreground hover:bg-muted/80',
        link:
          'text-primary underline-offset-4 hover:underline p-0 h-auto hover:translate-y-0',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-md',
        md: 'h-9 px-4 text-sm rounded-md',
        lg: 'h-11 px-6 text-base rounded-lg',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0 text-xs',
        'icon-lg': 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
