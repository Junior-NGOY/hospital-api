/**
 * Normalise un téléphone RDC pour comparaison (n° national 9 chiffres).
 * Accepte +243, 00243, 0XXXXXXXXX, espaces.
 */
export function nationalPhoneCd(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("243")) {
    digits = digits.slice(3);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

export function phonesMatchCd(
  stored: string | null | undefined,
  submitted: string | null | undefined
): boolean {
  const a = nationalPhoneCd(stored);
  const b = nationalPhoneCd(submitted);
  if (!a || !b) return false;
  return a === b;
}
