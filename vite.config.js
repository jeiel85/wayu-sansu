import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// public/sw.js는 그대로 복사되므로, 빌드마다 바뀌는 해시 자산 목록과 빌드 ID를 넣어
// 첫 방문 직후에도 오프라인 실행이 되고 배포마다 서비스 워커가 갱신되게 한다.
function swPrecacheManifest() {
  let outDir = 'dist';
  return {
    name: 'sw-precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/'))
        .map((f) => `./${f}`)
        .sort();
      const buildId = Date.now().toString(36);
      const swPath = join(outDir, 'sw.js');
      const src = readFileSync(swPath, 'utf-8');
      const out = src
        .replace("const BUILD_ID = 'dev';", `const BUILD_ID = '${buildId}';`)
        .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(assets)};`);
      if (out === src) throw new Error('sw.js placeholder not found');
      writeFileSync(swPath, out);
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [swPrecacheManifest()],
  server: {
    port: 5173,
    open: false
  }
});
