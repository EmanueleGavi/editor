import argon2 from 'argon2';

// Parametri OWASP 2024 per argon2id
const OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain: string) => argon2.hash(plain, OPTS);
export const verifyPassword = (hash: string, plain: string) =>
  argon2.verify(hash, plain).catch(() => false);

// Hash fittizio per confronto a tempo costante quando l'utente non esiste
export const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$' +
  'ZGFtbXlIYXNoRGFtbXlIYXNoRGFtbXlIYXNoRGFtbXk';