import { MAX_TEXT, countWords } from '../utils/text';
export function TextInput({ text, onChange }: { text: string; onChange: (value: string) => void }) {
  return (
    <>
      <label className="sr-only" htmlFor="speech-text">
        Text to convert to speech
      </label>
      <textarea
        id="speech-text"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'Your next great story starts here.\nType, paste, or import your text…'}
        aria-describedby="text-count"
        spellCheck
      />
      <div className="editor-count" id="text-count">
        <span>{countWords(text).toLocaleString()} words</span>
        <span className={text.length > MAX_TEXT ? 'invalid' : ''}>
          {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()} characters
        </span>
      </div>
    </>
  );
}
