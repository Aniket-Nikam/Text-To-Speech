import { z } from 'zod';
import { ApiError } from './errors.js';
export const MAX_TEXT = 5000;
export const textSchema = z
  .string()
  .min(1)
  .max(MAX_TEXT)
  .refine((t) => !!t.trim(), 'Enter some text.')
  .refine(
    (t) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/u.test(t),
    'Remove unsupported control characters.',
  );
export const ttsSchema = z
  .object({
    text: textSchema,
    language: z.string().min(2).max(35),
    voice: z.string().min(1).max(150),
    speed: z.number().min(0.5).max(2).default(1),
    pitch: z.number().min(-50).max(50).default(0),
    volume: z.number().min(0).max(1).default(1),
    style: z.string().max(80).default(''),
    save: z.boolean().default(false),
  })
  .strict();
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      result.error.issues.map((i) => `${i.path.join('.') || 'Request'}: ${i.message}`).join(' '),
    );
  return result.data;
}
export function validateVoice(input, voices) {
  if (!voices.some((v) => v.language === input.language))
    throw new ApiError(400, 'INVALID_LANGUAGE', 'The selected language is not supported.');
  const voice = voices.find((v) => v.id === input.voice);
  if (!voice) throw new ApiError(400, 'INVALID_VOICE', 'The selected voice is not available.');
  if (voice.language !== input.language)
    throw new ApiError(
      400,
      'VOICE_LANGUAGE_MISMATCH',
      'Choose a voice that matches the selected language.',
    );
  if (input.style && !voice.styles.includes(input.style))
    throw new ApiError(400, 'INVALID_STYLE', 'This style is not available for the selected voice.');
  return voice;
}
