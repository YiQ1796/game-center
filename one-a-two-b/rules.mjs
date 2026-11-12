export const CODE_LENGTH = 4;
export const DIGITS = '0123456789';

export function isCode(value) {
  return typeof value === 'string' && /^\d{4}$/.test(value) && new Set(value).size === CODE_LENGTH;
}

export function isSeed(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}$/.test(value);
}

// Version 1 challenge links depend on this deterministic shuffle.
export function codeForSeed(seed) {
  const pool = [...DIGITS];
  let state = Number.parseInt(seed, 16);
  for (let index = 0; index < CODE_LENGTH; index++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    const fraction = ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
    const pick = index + Math.floor(fraction * (pool.length - index));
    [pool[index], pool[pick]] = [pool[pick], pool[index]];
  }
  return pool.slice(0, CODE_LENGTH).join('');
}

export function scoreGuess(answer, guess) {
  let a = 0;
  let shared = 0;
  for (let index = 0; index < CODE_LENGTH; index++) {
    if (guess[index] === answer[index]) a++;
    if (answer.includes(guess[index])) shared++;
  }
  return { a, b: shared - a };
}

export function uniqueDigits(value) {
  return [...new Set(String(value).match(/\d/g))].join('');
}
