import { describe, it, expect } from 'vitest';
import { validateText, countWords, MAX_TEXT } from './text';
describe('text validation', () => {
  it('rejects empty and whitespace', () => {
    expect(validateText('')).toBeTruthy();
    expect(validateText(' \n ')).toBeTruthy();
  });
  it('accepts the exact limit and rejects excess without truncation', () => {
    expect(validateText('a'.repeat(MAX_TEXT))).toBe('');
    expect(validateText('a'.repeat(MAX_TEXT + 1))).toBeTruthy();
  });
  it('accepts multilingual text and rejects control characters', () => {
    expect(validateText('नमस्कार मराठी हिंदी ગુજરાતી 👋')).toBe('');
    expect(validateText('hello\0')).toBeTruthy();
  });
  it('counts words', () => {
    expect(countWords('  hello\nworld ')).toBe(2);
    expect(countWords(' ')).toBe(0);
  });
});
