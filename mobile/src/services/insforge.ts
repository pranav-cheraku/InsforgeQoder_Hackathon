import { createClient } from '@insforge/sdk';

const baseUrl = process.env.EXPO_PUBLIC_INSFORGE_URL;
const anonKey = process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY;

if (!baseUrl) console.error('[InsForge] EXPO_PUBLIC_INSFORGE_URL is not set');
if (!anonKey) console.error('[InsForge] EXPO_PUBLIC_INSFORGE_ANON_KEY is not set');
else console.log('[InsForge] client init →', baseUrl);

export const insforge = createClient({
  baseUrl: baseUrl!,
  anonKey: anonKey!,
});
