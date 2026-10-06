/**
 * Currency and general formatters for display in the UI.
 */

/**
 * Formats an integer paise value into a human-readable Rupees string.
 * e.g. 21000000 → "₹2,10,000"
 */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN');
}
