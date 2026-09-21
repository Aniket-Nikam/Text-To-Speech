import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApp } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config();

const port = Number(process.env.PORT) || 3001;
createApp().listen(port, () => console.log(`Speech API listening on port ${port}`));
