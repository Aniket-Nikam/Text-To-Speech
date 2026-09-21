import { ArrowRight, Trash } from '@phosphor-icons/react';
export function ClearButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="subtle" onClick={onClick} disabled={disabled}>
      <Trash size={17} />
      Clear
    </button>
  );
}
export function GenerateButton({
  onClick,
  busy,
  disabled,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <button className="primary generate" onClick={onClick} disabled={busy || disabled}>
      {busy ? <span className="spinner" /> : <ArrowRight size={20} />}{' '}
      {busy ? 'Generating speech…' : 'Generate speech'}
    </button>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      {message}
    </div>
  ) : null;
}
