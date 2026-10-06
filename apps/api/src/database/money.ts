/**
 * Financial Precision & Money Utilities
 *
 * Implements exact integer-based monetary conversions between Rupees and Paise (1 Rupee = 100 Paise).
 * Eliminates IEEE 754 floating-point arithmetic errors in financial calculations.
 */

/**
 * Converts a Rupee value (number or string representation) into integer Paise.
 * Uses string parsing to prevent JavaScript floating-point rounding bugs (e.g. 19.99 * 100 = 1998.9999999999998).
 *
 * @param rupees Amount in rupees (e.g. 1500, "1500.50", "0.75")
 * @returns Amount in integer paise as bigint
 */
export function rupeesToPaise(rupees: number | string): bigint {
  const str = String(rupees).trim();
  if (!str || str === '0') {
    return 0n;
  }

  // Handle negative sign
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const parts = cleanStr.split('.');
  const whole = parts[0] || '0';
  let fraction = parts[1] || '';

  if (fraction.length === 0) {
    fraction = '00';
  } else if (fraction.length === 1) {
    fraction = fraction + '0';
  } else {
    // Truncate/round to 2 decimal places
    fraction = fraction.substring(0, 2);
  }

  const paiseStr = `${whole}${fraction}`.replace(/^0+(?=\d)/, '');
  const paise = BigInt(paiseStr || '0');
  return isNegative ? -paise : paise;
}

/**
 * Converts integer Paise into a standard 2-decimal-place Rupee string.
 *
 * @param paise Amount in integer paise (e.g. 150050n -> "1500.50")
 * @returns Formatted decimal string "XXXX.YY"
 */
export function paiseToRupees(paise: bigint | number): string {
  const bi = typeof paise === 'number' ? BigInt(Math.round(paise)) : paise;
  const isNegative = bi < 0n;
  const abs = isNegative ? -bi : bi;

  const whole = abs / 100n;
  const remainder = abs % 100n;
  const remainderStr = remainder.toString().padStart(2, '0');

  const formatted = `${whole.toString()}.${remainderStr}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats integer Paise as an Indian Rupee currency display string (e.g. "₹1,500.50").
 */
export function formatCurrencyRupees(paise: bigint | number): string {
  const rupeeDecimalStr = paiseToRupees(paise);
  const num = Number(rupeeDecimalStr);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Safely sums multiple paise amounts without precision loss.
 */
export function safeAddPaise(...amounts: (bigint | number)[]): bigint {
  return amounts.reduce<bigint>((acc, val) => {
    const bi = typeof val === 'number' ? BigInt(Math.round(val)) : val;
    return acc + bi;
  }, 0n);
}

/**
 * Safely subtracts subtrahend from minuend in paise.
 */
export function safeSubtractPaise(
  minuend: bigint | number,
  subtrahend: bigint | number
): bigint {
  const a = typeof minuend === 'number' ? BigInt(Math.round(minuend)) : minuend;
  const b = typeof subtrahend === 'number' ? BigInt(Math.round(subtrahend)) : subtrahend;
  return a - b;
}
