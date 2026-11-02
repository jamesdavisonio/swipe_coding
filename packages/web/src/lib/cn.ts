import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge class lists; later Tailwind utilities win over earlier ones of the same kind.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
