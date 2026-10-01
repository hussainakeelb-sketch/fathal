import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import fs from 'node:fs';

// محتوى بسيط داخل الصفحة لمحركات البحث (كوكل) قبل ما تشتغل اللعبة.
// يتكوّن تلقائياً من قائمة الفئات، والتطبيق يبدّله أول ما يشتغل.
function seoContent() {
  return {
    name: 'fathal-seo',
    transformIndexHtml(html) {
      const data = JSON.parse(fs.readFileSync(new URL('./data/categories.json', import.meta.url), 'utf8'));
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const sections = data.sections
        .map((s) => {
          const names = data.categories.filter((c) => c.section === s.id).map((c) => esc(c.name));
          return `<h3>${esc(s.name)}</h3><p>${names.join('، ')}</p>`;
        })
        .join('');
      return html.replace('<!--seo-cats-->', sections).replace('<!--seo-count-->', String(data.categories.length));
    },
  };
}

export default defineConfig({
  plugins: [preact(), seoContent()],
  server: { port: 5173 },
});
