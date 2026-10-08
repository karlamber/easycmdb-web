/** QInput `clearable` emits `null`; normalize for string refs and filtering. */
export function coerceSearchInputModelValue(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

export function emptyToNull(value: string): string | null {
  const t = value.trim();
  return t === '' ? null : t;
}

export function optionalString(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  return emptyToNull(value);
}
