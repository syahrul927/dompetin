/**
 * Formats a number as Indonesian Rupiah currency
 * @param amount - Raw integer IDR value (always positive)
 * @returns Formatted string with "Rp" prefix and thousand separators
 * @example formatIDR(18350000) // Returns: "Rp 18.350.000"
 */
export function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
