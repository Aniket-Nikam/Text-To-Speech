import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TextInput } from './TextInput';
import { LanguageSelector, VoiceSelector } from './VoiceSelectors';
import { AudioPlayer } from './AudioPlayer';
import { AudioCustomization } from './AudioCustomization';
import { FileUpload } from './FileUpload';
import { GenerateButton, ClearButton } from './Buttons';
import { defaults } from '../services/api';
const voices = [
  {
    id: 'en',
    name: 'Jenny',
    language: 'en-US',
    localeName: 'English',
    gender: 'Female',
    type: 'Neural',
    styles: [],
  },
  {
    id: 'hi',
    name: 'Swara',
    language: 'hi-IN',
    localeName: 'Hindi',
    gender: 'Female',
    type: 'Neural',
    styles: [],
  },
];
describe('studio controls', () => {
  it('shows counts and preserves over-limit text', () => {
    const change = vi.fn();
    const { rerender } = render(<TextInput text="Hello world" onChange={change} />);
    expect(screen.getByText('2 words')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'updated' } });
    expect(change).toHaveBeenCalledWith('updated');
    rerender(<TextInput text={'a'.repeat(5001)} onChange={change} />);
    expect(screen.getByRole('textbox')).toHaveValue('a'.repeat(5001));
    expect(screen.getByText('5,001 / 5,000 characters')).toHaveClass('invalid');
  });
  it('filters voices on language change', () => {
    const change = vi.fn();
    const { rerender } = render(
      <VoiceSelector voices={voices} language="en-US" value="en" onChange={change} />,
    );
    expect(screen.getByRole('option', { name: /Jenny/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Swara/ })).toBeNull();
    rerender(<VoiceSelector voices={voices} language="hi-IN" value="hi" onChange={change} />);
    expect(screen.queryByRole('option', { name: /Jenny/ })).toBeNull();
    expect(screen.getByRole('option', { name: /Swara/ })).toBeInTheDocument();
  });
  it('selects a language', () => {
    const change = vi.fn();
    render(<LanguageSelector voices={voices} value="en-US" onChange={change} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'hi-IN' } });
    expect(change).toHaveBeenCalledWith('hi-IN');
  });
  it('disables duplicate generation', () => {
    const click = vi.fn();
    render(<GenerateButton busy disabled={false} onClick={click} />);
    fireEvent.click(screen.getByRole('button'));
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('clears and resets settings', () => {
    const clear = vi.fn(),
      settings = vi.fn();
    render(
      <>
        <ClearButton onClick={clear} />
        <AudioCustomization value={{ ...defaults, speed: 2 }} onChange={settings} styles={[]} />
      </>,
    );
    fireEvent.click(screen.getByText('Clear'));
    expect(clear).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Reset'));
    expect(settings).toHaveBeenCalledWith(defaults);
  });
  it('imports TXT text and reports invalid files', async () => {
    const text = vi.fn(),
      error = vi.fn();
    render(<FileUpload onText={text} onError={error} />);
    const file = new File(['Hello'], 'hello.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => 'Hello' });
    fireEvent.change(screen.getByLabelText('Import text file'), { target: { files: [file] } });
    await waitFor(() => expect(text).toHaveBeenCalledWith('Hello'));
    fireEvent.change(screen.getByLabelText('Import text file'), {
      target: { files: [new File(['bad'], 'bad.exe')] },
    });
    await waitFor(() => expect(error).toHaveBeenCalled());
  });
  it('provides real audio controls, replay and download', () => {
    const error = vi.fn();
    render(<AudioPlayer audio={{ url: 'blob:test', title: 'Hello' }} onError={error} />);
    const player = screen.getByLabelText('Generated speech playback') as HTMLAudioElement;
    expect(player.controls).toBe(true);
    expect(player.src).toBe('blob:test');
    expect(screen.getByRole('link', { name: 'Download MP3' })).toHaveAttribute(
      'download',
      'labmentix-speech.mp3',
    );
    const play = vi.spyOn(player, 'play').mockResolvedValue();
    player.currentTime = 10;
    fireEvent.click(screen.getByText('Replay'));
    expect(player.currentTime).toBe(0);
    expect(play).toHaveBeenCalled();
    fireEvent.error(player);
    expect(error).toHaveBeenCalled();
  });
});
