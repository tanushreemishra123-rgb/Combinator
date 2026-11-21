import { MAX_REQUIREMENTS_CHARACTERS, MIN_REQUIREMENTS_CHARACTERS } from './constants';
import { validateRequirementsText } from './validate';

describe('validateRequirementsText', () => {
  it('flags empty text with a single, user-facing error', () => {
    const issues = validateRequirementsText('   \n  ');
    expect(issues).toHaveLength(1);
    expect(issues.at(0)).toMatchObject({ severity: 'error', code: 'empty' });
    expect(issues.at(0)?.message).not.toMatch(/undefined|null|NaN/);
  });

  it('flags text shorter than the minimum with a specific character count', () => {
    const shortText = 'Too short.';
    const issues = validateRequirementsText(shortText);
    expect(issues.some((issue) => issue.code === 'too-short')).toBe(true);
    expect(issues.find((issue) => issue.code === 'too-short')?.message).toContain(String(shortText.length));
  });

  it('flags text longer than the maximum', () => {
    const longText = 'A'.repeat(MAX_REQUIREMENTS_CHARACTERS + 1);
    const issues = validateRequirementsText(longText);
    expect(issues.some((issue) => issue.code === 'too-long')).toBe(true);
  });

  it('flags text with no letter characters at all', () => {
    const numericText = '0123456789 '.repeat(10);
    const issues = validateRequirementsText(numericText);
    expect(issues.some((issue) => issue.code === 'no-letters')).toBe(true);
  });

  it('returns no issues for adequately sized, readable text', () => {
    const goodText = 'The customer needs a member portal that supports self-service registration. '.repeat(2);
    expect(goodText.trim().length).toBeGreaterThanOrEqual(MIN_REQUIREMENTS_CHARACTERS);
    expect(validateRequirementsText(goodText)).toEqual([]);
  });

  it('accepts non-Latin text as containing letters', () => {
    const cjkText = '系统必须支持多语言用户界面，并且需要与现有的客户关系管理系统集成。'.repeat(3);
    const issues = validateRequirementsText(cjkText);
    expect(issues.some((issue) => issue.code === 'no-letters')).toBe(false);
  });
});
