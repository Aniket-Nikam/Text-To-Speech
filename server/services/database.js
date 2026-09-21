import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../utils/errors.js';
function checked(result) {
  if (result.error)
    throw new ApiError(
      503,
      'DATABASE_UNAVAILABLE',
      'Your saved data could not be accessed. Please try again.',
    );
  return result.data;
}
export function createDatabase(env = process.env) {
  const configured = !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
  if (!configured) return { configured: false };
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  function scoped(token) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return {
    configured,
    async authenticate(token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user)
        throw new ApiError(
          401,
          'INVALID_SESSION',
          'Your session has expired. Please sign in again.',
        );
      return { id: data.user.id, email: data.user.email, db: scoped(token) };
    },
    async profile(user) {
      return checked(
        await user.db
          .from('profiles')
          .select('id,email,role,created_at')
          .eq('id', user.id)
          .single(),
      );
    },
    async reserve(user, limit) {
      const allowed = checked(
        await admin.rpc('reserve_generation', { p_user_id: user.id, p_limit: limit }),
      );
      if (!allowed)
        throw new ApiError(
          429,
          'DAILY_LIMIT',
          'You have reached today’s generation limit. Please return tomorrow.',
        );
    },
    async logUsage(user, input) {
      checked(
        await admin.from('usage_logs').insert({
          user_id: user.id,
          character_count: input.text.length,
          language: input.language,
          voice: input.voice,
        }),
      );
    },
    async save(user, input, audio) {
      const id = randomUUID(),
        path = `${user.id}/${id}.mp3`;
      checked(
        await admin.storage
          .from('speech-audio')
          .upload(path, audio, { contentType: 'audio/mpeg', upsert: false }),
      );
      try {
        checked(
          await admin.from('speech_history').insert({
            id,
            user_id: user.id,
            text: input.text,
            language: input.language,
            voice: input.voice,
            audio_path: path,
            speed: input.speed,
            pitch: input.pitch,
            volume: input.volume,
            style: input.style,
          }),
        );
        return id;
      } catch (e) {
        const cleanup = await admin.storage.from('speech-audio').remove([path]);
        if (cleanup.error)
          console.error(JSON.stringify({ event: 'storage_cleanup_failed', code: 'ORPHAN_AUDIO' }));
        throw e;
      }
    },
    async history(user, offset) {
      const result = await user.db
        .from('speech_history')
        .select('id,text,language,voice,speed,pitch,volume,style,created_at,audio_path', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + 19);
      return { items: checked(result), total: result.count };
    },
    async get(user, id) {
      const item = checked(
        await user.db.from('speech_history').select('*').eq('id', id).maybeSingle(),
      );
      if (!item) throw new ApiError(404, 'SPEECH_NOT_FOUND', 'This speech was not found.');
      return item;
    },
    async audio(user, id) {
      const item = await this.get(user, id);
      if (!item.audio_path)
        throw new ApiError(
          404,
          'AUDIO_EXPIRED',
          'This audio has expired. Its text is still available.',
        );
      const result = await user.db.storage
        .from('speech-audio')
        .createSignedUrl(item.audio_path, 300, { download: 'labmentix-speech.mp3' });
      return checked(result).signedUrl;
    },
    async remove(user, id) {
      const item = await this.get(user, id);
      if (item.audio_path)
        checked(await admin.storage.from('speech-audio').remove([item.audio_path]));
      checked(await user.db.from('speech_history').delete().eq('id', id));
    },
    async favorites(user) {
      return checked(
        await user.db
          .from('favorites')
          .select('speech_id,created_at')
          .order('created_at', { ascending: false }),
      );
    },
    async favorite(user, id) {
      await this.get(user, id);
      checked(
        await user.db
          .from('favorites')
          .upsert({ user_id: user.id, speech_id: id }, { onConflict: 'user_id,speech_id' }),
      );
    },
    async unfavorite(user, id) {
      checked(await user.db.from('favorites').delete().eq('speech_id', id));
    },
    async analytics(user) {
      const profile = await this.profile(user);
      if (profile.role !== 'admin')
        throw new ApiError(403, 'ADMIN_REQUIRED', 'Administrator access is required.');
      return checked(await admin.rpc('usage_analytics'));
    },
    async cleanup(days = 30) {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const rows = checked(
        await admin
          .from('speech_history')
          .select('id,audio_path')
          .lt('created_at', cutoff)
          .not('audio_path', 'is', null)
          .limit(100),
      );
      for (const row of rows) {
        checked(await admin.storage.from('speech-audio').remove([row.audio_path]));
        checked(await admin.from('speech_history').update({ audio_path: null }).eq('id', row.id));
      }
      return rows.length;
    },
    async cleanupOrphans(days = 30) {
      const bucket = admin.storage.from('speech-audio'),
        cutoff = Date.now() - days * 86400000;
      async function all(prefix) {
        const items = [];
        for (let offset = 0; ; offset += 100) {
          const page = checked(
            await bucket.list(prefix, {
              limit: 100,
              offset,
              sortBy: { column: 'name', order: 'asc' },
            }),
          );
          items.push(...page);
          if (page.length < 100) return items;
        }
      }
      let removed = 0;
      const folders = await all('');
      for (const folder of folders) {
        if (!/^[0-9a-f-]{36}$/i.test(folder.name) || folder.id) continue;
        const files = await all(folder.name);
        for (const file of files) {
          if (
            !file.id ||
            !file.name.endsWith('.mp3') ||
            !file.created_at ||
            Date.parse(file.created_at) >= cutoff
          )
            continue;
          const path = `${folder.name}/${file.name}`;
          const row = checked(
            await admin.from('speech_history').select('id').eq('audio_path', path).maybeSingle(),
          );
          if (!row) {
            checked(await bucket.remove([path]));
            removed++;
          }
        }
      }
      return removed;
    },
  };
}
