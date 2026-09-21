import { useRef, useState } from 'react';
import { UploadSimple } from '@phosphor-icons/react';
import { validateText } from '../utils/text';
import { api } from '../services/api';
export function FileUpload({
  onText,
  onError,
}: {
  onText: (text: string) => void;
  onError: (error: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function read(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const types: Record<string, string[]> = {
        txt: ['text/plain', 'application/octet-stream'],
        pdf: ['application/pdf'],
        docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      };
      if (!extension || !types[extension] || (file.type && !types[extension].includes(file.type)))
        throw Error('Please choose a TXT, PDF, or DOCX file.');
      if (file.size > 5 * 1024 * 1024) throw Error('Choose a file smaller than 5 MB.');
      let text: string;
      if (extension === 'txt') {
        text = await file.text();
      } else {
        const form = new FormData();
        form.append('file', file);
        text = (await api<{ text: string }>('/files/extract', { method: 'POST', body: form })).text;
      }
      const error = validateText(text);
      if (error) throw Error(error);
      onText(text);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Unable to read that file.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy) void read(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".txt,.pdf,.docx"
        className="sr-only"
        aria-label="Import text file"
        onChange={(e) => void read(e.target.files?.[0])}
        disabled={busy}
      />
      <button className="subtle" onClick={() => input.current?.click()} disabled={busy}>
        <UploadSimple size={18} />
        {busy ? 'Reading file…' : 'Import file'}
      </button>
    </div>
  );
}
