export function createCryptoSeed(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `payaw-${(values[0] ?? 0).toString(36)}-${(values[1] ?? 0).toString(36)}`;
}

export function createRuleId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const values = new Uint32Array(3);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(36)).join('-');
}
