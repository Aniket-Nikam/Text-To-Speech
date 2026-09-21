import { ApiError } from '../utils/errors.js';
import pkg from '@andresaya/edge-tts';
const { EdgeTTS } = pkg;

export const escapeXml = (value) =>
  String(value).replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c],
  );

export function buildSsml({ text, language, voice, speed = 1, pitch = 0, volume = 1, style = '' }) {
  const prosody = `<prosody rate="${Math.round((speed - 1) * 100)}%" pitch="${pitch >= 0 ? '+' : ''}${pitch}%" volume="${Math.round(volume * 100)}">${escapeXml(text)}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${escapeXml(language)}"><voice name="${escapeXml(voice)}">${style ? `<mstts:express-as style="${escapeXml(style)}">${prosody}</mstts:express-as>` : prosody}</voice></speak>`;
}

export function createTtsProvider(env = process.env, fetcher = fetch) {
  let cache = [],
    expires = 0,
    pending;

  const providerType =
    env.TTS_PROVIDER ||
    (env.TTS_API_KEY && env.TTS_REGION ? 'azure' : env === process.env ? 'edge' : null);

  const isAzure = providerType === 'azure';
  const isEdge = providerType === 'edge';

  const configured = Boolean(
    (isAzure && env.TTS_API_KEY && /^[a-z0-9-]+$/.test(env.TTS_REGION || '')) || isEdge,
  );

  async function callAzure(path, options = {}) {
    if (!configured)
      throw new ApiError(
        503,
        'TTS_NOT_CONFIGURED',
        'Speech generation is not configured. Add the Azure Speech key and region on the server.',
      );
    try {
      const r = await fetcher(`https://${env.TTS_REGION}.tts.speech.microsoft.com${path}`, {
        ...options,
        headers: { 'Ocp-Apim-Subscription-Key': env.TTS_API_KEY, ...options.headers },
      });
      if (r.status === 401 || r.status === 403)
        throw new ApiError(
          503,
          'TTS_AUTH_FAILED',
          'The speech service rejected the server key. Check TTS_API_KEY.',
        );
      if (r.status === 429)
        throw new ApiError(
          429,
          'TTS_RATE_LIMITED',
          'The speech service is busy. Wait a moment and retry.',
        );
      if (!r.ok)
        throw new ApiError(
          503,
          'TTS_UNAVAILABLE',
          `The speech service failed with status ${r.status}.`,
        );
      return r;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(
        503,
        'TTS_UNAVAILABLE',
        'Unable to reach the speech service. Check network connectivity and TTS_REGION.',
      );
    }
  }

  return {
    configured,
    async listVoices() {
      if (!configured)
        throw new ApiError(
          503,
          'TTS_NOT_CONFIGURED',
          'Speech generation is not configured on this server.',
        );
      if (Date.now() < expires) return cache;
      if (pending) return pending;
      pending = (async () => {
        if (isEdge) {
          try {
            const tts = new EdgeTTS();
            const data = await tts.getVoices();
            if (!Array.isArray(data))
              throw new ApiError(
                503,
                'INVALID_PROVIDER_RESPONSE',
                'The speech service returned an invalid voice list.',
              );
            cache = data
              .filter(
                (v) =>
                  v.VoiceType === 'Neural' &&
                  typeof v.ShortName === 'string' &&
                  typeof v.Locale === 'string',
              )
              .map((v) => ({
                id: v.ShortName,
                name: v.DisplayName || v.ShortName,
                language: v.Locale,
                localeName: v.LocaleName || v.Locale,
                gender: v.Gender || 'Neural',
                type: v.VoiceType,
                styles: [],
              }));
            expires = Date.now() + 3600000;
            return cache;
          } catch (e) {
            if (e instanceof ApiError) throw e;
            throw new ApiError(
              503,
              'TTS_UNAVAILABLE',
              'Unable to fetch the voice list. Please try again.',
            );
          }
        }

        // Azure mode
        const r = await callAzure('/cognitiveservices/voices/list');
        let data;
        try {
          data = await r.json();
        } catch {
          throw new ApiError(
            503,
            'INVALID_PROVIDER_RESPONSE',
            'The speech service did not return valid JSON.',
          );
        }
        if (!Array.isArray(data))
          throw new ApiError(
            503,
            'INVALID_PROVIDER_RESPONSE',
            'The speech service returned an invalid voice list.',
          );
        cache = data
          .filter(
            (v) =>
              v.VoiceType === 'Neural' &&
              typeof v.ShortName === 'string' &&
              typeof v.Locale === 'string',
          )
          .map((v) => ({
            id: v.ShortName,
            name: v.DisplayName || v.ShortName,
            language: v.Locale,
            localeName: v.LocaleName || v.Locale,
            gender: v.Gender || 'Neural',
            type: v.VoiceType,
            styles: Array.isArray(v.StyleList) ? v.StyleList : [],
          }));
        expires = Date.now() + 3600000;
        return cache;
      })();
      try {
        return await pending;
      } finally {
        pending = null;
      }
    },
    async synthesize(input) {
      if (!configured)
        throw new ApiError(
          503,
          'TTS_NOT_CONFIGURED',
          'Speech generation is not configured on this server.',
        );

      if (isEdge) {
        try {
          const tts = new EdgeTTS();
          const ratePercent = Math.round(((input.speed || 1) - 1) * 100);
          const rateStr = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;
          const pitchVal = Math.round(input.pitch || 0);
          const pitchStr = `${pitchVal >= 0 ? '+' : ''}${pitchVal}Hz`;
          const volumePercent = Math.round(((input.volume ?? 1) - 1) * 100);
          const volumeStr = `${volumePercent >= 0 ? '+' : ''}${volumePercent}%`;

          await tts.synthesize(input.text, input.voice, {
            rate: rateStr,
            pitch: pitchStr,
            volume: volumeStr,
          });
          const audio = await tts.toBuffer();

          if (audio.length >= 3_480_000)
            throw new ApiError(
              400,
              'AUDIO_TOO_LONG',
              'This passage is too long at the selected speed. Shorten the text or increase the speed.',
            );
          if (
            audio.length < 16 ||
            audio.length > 10 * 1024 * 1024 ||
            !(
              audio.subarray(0, 3).toString() === 'ID3' ||
              (audio[0] === 255 && (audio[1] & 224) === 224)
            )
          )
            throw new ApiError(
              503,
              'INVALID_AUDIO',
              'The speech service did not return valid MP3 audio.',
            );
          return audio;
        } catch (e) {
          if (e instanceof ApiError) throw e;
          throw new ApiError(
            503,
            'TTS_UNAVAILABLE',
            'Unable to reach the speech service. Please try again.',
          );
        }
      }

      // Azure mode
      const r = await callAzure('/cognitiveservices/v1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'LabMentixTTS',
        },
        body: buildSsml(input),
      });
      let audio;
      try {
        audio = Buffer.from(await r.arrayBuffer());
      } catch {
        throw new ApiError(
          503,
          'TTS_UNAVAILABLE',
          'The audio download was interrupted. Please try again.',
        );
      }
      if (audio.length >= 3_480_000)
        throw new ApiError(
          400,
          'AUDIO_TOO_LONG',
          'This passage is too long at the selected speed. Shorten the text or increase the speed.',
        );
      if (
        audio.length < 16 ||
        audio.length > 10 * 1024 * 1024 ||
        !(
          audio.subarray(0, 3).toString() === 'ID3' ||
          (audio[0] === 255 && (audio[1] & 224) === 224)
        )
      )
        throw new ApiError(
          503,
          'INVALID_AUDIO',
          'The speech service did not return valid MP3 audio.',
        );
      return audio;
    },
  };
}
