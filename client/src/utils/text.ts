export const MAX_TEXT = 5000;
export function validateText(text: string) {
  if (!text.trim()) return 'Enter some text before continuing.';
  if (text.length > MAX_TEXT)
    return `Keep your text within ${MAX_TEXT.toLocaleString()} characters. Nothing has been truncated.`;
  if (
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(text) ||
    /[\uD800-\uDFFF]/u.test(text)
  )
    return 'Remove unsupported control characters from your text.';
  return '';
}
export const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/u).length : 0);
