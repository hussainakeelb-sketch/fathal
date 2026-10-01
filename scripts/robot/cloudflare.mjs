// الاتصال بـ Cloudflare: قاعدة البلاغات (D1) وتوليد الصور (Workers AI). كلها ضمن الباقة المجانية.
import { CF, MOCK } from './config.mjs';
import { mockD1, mockImage } from './mock.mjs';

const API = 'https://api.cloudflare.com/client/v4';
let images = 0;
export const imagesLeft = () => CF.maxImages - images;

async function cf(path, body) {
  const res = await fetch(`${API}/accounts/${CF.accountId}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${CF.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(`Cloudflare ${res.status}: ${JSON.stringify(data.errors || data).slice(0, 300)}`);
  return data.result;
}

export async function d1(sql, params = []) {
  if (MOCK) return mockD1(sql, params);
  const result = await cf(`/d1/database/${CF.d1Id}/query`, { sql, params });
  return result?.[0]?.results ?? [];
}

// صورة بالذكاء الاصطناعي (FLUX.1 schnell). ترجع Buffer (JPEG)
export async function aiImage(prompt) {
  if (imagesLeft() <= 0) throw new Error('image-budget');
  images++;
  if (MOCK) return mockImage(prompt);
  const result = await cf('/ai/run/@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 6 });
  if (!result?.image) throw new Error('ما رجعت صورة');
  return Buffer.from(result.image, 'base64');
}
