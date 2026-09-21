import { useRef } from 'react';
import { DownloadSimple, ArrowCounterClockwise, Waveform } from '@phosphor-icons/react';
export function DownloadButton({ url }: { url: string }) {
  return (
    <a className="download" href={url} download="labmentix-speech.mp3">
      <DownloadSimple size={18} />
      Download MP3
    </a>
  );
}
export function AudioPlayer({
  audio,
  onError,
}: {
  audio: { url: string; title: string } | null;
  onError: (e: string) => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  return (
    <section className={`audio-panel ${audio ? 'ready' : ''}`} aria-label="Generated audio">
      <div className="audio-icon">
        <Waveform size={27} />
      </div>
      <div className="audio-body">
        <div className="section-row">
          <h2>{audio ? 'Your speech is ready' : 'Your audio will appear here'}</h2>
          {audio && <span className="format">MP3 · 24 kHz</span>}
        </div>
        {audio ? (
          <>
            <p className="audio-title">{audio.title}</p>
            <audio
              ref={ref}
              key={audio.url}
              controls
              preload="metadata"
              src={audio.url}
              onError={() => onError('This audio could not be played. Try generating it again.')}
              aria-label="Generated speech playback"
            />
            <div className="audio-actions">
              <button
                className="subtle"
                onClick={() => {
                  if (ref.current) {
                    ref.current.currentTime = 0;
                    void ref.current
                      .play()
                      .catch(() =>
                        onError('Playback could not start. Please use the play control.'),
                      );
                  }
                }}
              >
                <ArrowCounterClockwise size={17} />
                Replay
              </button>
              <DownloadButton url={audio.url} />
            </div>
          </>
        ) : (
          <p>Generate speech to listen, fine-tune, and download.</p>
        )}
      </div>
    </section>
  );
}
