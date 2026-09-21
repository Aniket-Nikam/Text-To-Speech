import 'dotenv/config';
import { createDatabase } from '../services/database.js';
const database = createDatabase();
if (!database.configured) {
  console.error('Configure Supabase before running retention cleanup.');
  process.exitCode = 1;
} else {
  try {
    let total = 0,
      count;
    do {
      count = await database.cleanup(30);
      total += count;
    } while (count === 100);
    const orphans = await database.cleanupOrphans(30);
    console.log(
      `Expired ${total} audio files and removed ${orphans} old orphan files. History text was preserved.`,
    );
  } catch {
    console.error('Retention cleanup failed. Verify Supabase configuration and retry.');
    process.exitCode = 1;
  }
}
