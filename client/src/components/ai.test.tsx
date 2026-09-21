import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiEnhancement } from './AiEnhancement';
vi.mock('../services/api', () => ({ api: vi.fn(async () => ({ text: 'Improved text' })) }));
it('previews enhanced text without overwriting the original until applied', async () => {
  const apply = vi.fn();
  render(<AiEnhancement text="Original text" onApply={apply} />);
  fireEvent.click(screen.getByText('Fix grammar'));
  await waitFor(() =>
    expect(screen.getByLabelText('Review your enhanced text')).toHaveValue('Improved text'),
  );
  expect(apply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Review your enhanced text'), {
    target: { value: 'My edit' },
  });
  fireEvent.click(screen.getByText('Use this text'));
  expect(apply).toHaveBeenCalledWith('My edit');
});
