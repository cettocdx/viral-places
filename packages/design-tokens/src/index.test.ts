import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { categoryColor, categoryTextColor, designTokens, hexToRgba, spacing } from './index';

describe('design tokens', () => {
  it('generated tokens match config/design-tokens.json (single source of truth)', () => {
    const json = JSON.parse(readFileSync(resolve(__dirname, '../../../config/design-tokens.json'), 'utf8'));
    expect(designTokens).toEqual(json);
  });

  it('spacing scale equals the spec list 4,8,12,16,20,24,32', () => {
    expect(Object.values(spacing)).toEqual([...designTokens.spacing]);
  });

  it('family category uses darker amber for text on white', () => {
    expect(categoryColor('family')).toBe('#F2B544');
    expect(categoryTextColor('family')).toBe('#765100');
  });

  it('hexToRgba converts 6-digit hex', () => {
    expect(hexToRgba('#246BFD', 0.5)).toBe('rgba(36, 107, 253, 0.5)');
  });

  it('navigation is the single merged tab bar', () => {
    expect([...designTokens.navigation]).toEqual(['explore', 'saved', 'following', 'profile']);
  });
});
