import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = path.resolve('scraper/out/cache');

function hash(url: string) {
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

export interface FetchOpts {
  force?: boolean;
}

// Uses Node's built-in fetch (v18+) which handles redirects automatically.
export async function fetchCached(url: string, opts: FetchOpts = {}): Promise<string> {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${hash(url)}.html`);
  if (!opts.force && existsSync(file)) {
    return readFile(file, 'utf8');
  }
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      referer: 'https://www.iacompetitions.com/',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  const body = await res.text();
  await writeFile(file, body, 'utf8');
  return body;
}

export async function fetchBinaryCached(url: string, opts: FetchOpts = {}): Promise<Buffer> {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${hash(url)}.bin`);
  if (!opts.force && existsSync(file)) {
    return readFile(file);
  }
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return buf;
}
