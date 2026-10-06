export function sessionLengthInput(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function parseSessionMinutes(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const minutes = Number(value);
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
}
