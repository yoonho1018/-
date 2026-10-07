export function configuration(env, required = false) {
  const url = (env.SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url && !key && !required) return { url: '', key: '' };
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY를 설정하세요. Secret key는 사용할 수 없습니다.');
  }
  return { url, key };
}
export const configScript = config => `window.APP_CONFIG = ${JSON.stringify(config)};\n`;
