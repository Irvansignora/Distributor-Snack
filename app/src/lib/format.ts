/**
 * Format angka ke format Rupiah Indonesia.
 * Null-safe: value undefined/null/NaN dikonversi ke 0.
 */
export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value || 0);
}
