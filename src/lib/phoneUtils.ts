/**
 * Normalizes Brazilian phone numbers to E.164 format without the '+' sign.
 */
export function normalizeBrazilianPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length < 10 || digits.length > 11) {
    return null;
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    const firstDigit = parseInt(number[0], 10);
    if (firstDigit >= 6) {
      digits = ddd + '9' + number;
    }
  }

  return '55' + digits;
}

export function isValidBrazilianPhone(raw: string): boolean {
  return normalizeBrazilianPhone(raw) !== null;
}