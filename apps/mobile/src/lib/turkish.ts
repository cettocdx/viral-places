/**
 * Türkçe bulunma eki (-da/-de/-ta/-te): son ünlüye göre a/e, sert ünsüzle bitiyorsa d→t; özel adda kesme işareti.
 * "İstanbul" → "İstanbul’da", "Paris" → "Paris’te", "Londra" → "Londra’da", "Milano" → "Milano’da".
 */
export function locativeTr(name: string): string {
  const lower = name.toLocaleLowerCase('tr');
  const vowels = [...lower].filter((ch) => 'aıoueiöü'.includes(ch));
  const last = vowels[vowels.length - 1] ?? 'a';
  const back = 'aıou'.includes(last);
  const hard = 'fstkçşhp'.includes(lower[lower.length - 1] ?? '');
  return `${name}’${hard ? 't' : 'd'}${back ? 'a' : 'e'}`;
}
