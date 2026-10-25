// Pseudo-locale: accents every letter, pads the text by ~40% and wraps it in brackets, so
// hard-coded strings, truncation and overflow are visible without reading a real language.
const ACCENTED: Readonly<Record<string, string>> = {
  a: 'á',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'í',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ö',
  p: 'þ',
  q: 'ɋ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'ü',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'Á',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Í',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ö',
  P: 'Þ',
  Q: 'Ɋ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Ü',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

const EXPANSION = 0.4;
// Substitution tokens ($1…$9) and the escaped dollar ($$) must survive untouched.
const TOKEN = /\$(?:[1-9]|\$)/g;

/** Pseudo-localizes a message whose placeholders were already resolved to `$1…$9` tokens. */
export function pseudoLocalize(message: string): string {
  const parts = message.split(TOKEN);
  const tokens = message.match(TOKEN) ?? [];
  const accented = parts.map((part) => part.replace(/[a-z]/gi, (ch) => ACCENTED[ch] ?? ch));
  const letters = message.replace(TOKEN, '').length;
  const padding = '~'.repeat(Math.ceil(letters * EXPANSION));
  const body = accented.map((part, i) => part + (tokens[i] ?? '')).join('');
  return `[${body}${padding}]`;
}
