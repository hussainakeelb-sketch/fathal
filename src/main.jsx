import { render } from 'preact';
// الخطوط محفوظة ويه الموقع (بدون Google Fonts). المتصفح ينزّل بس الحروف الي يحتاجها.
import '@fontsource/lalezar/arabic-400.css';
import '@fontsource/lalezar/latin-400.css';
import '@fontsource/baloo-bhaijaan-2/arabic-400.css';
import '@fontsource/baloo-bhaijaan-2/arabic-600.css';
import '@fontsource/baloo-bhaijaan-2/latin-400.css';
import '@fontsource/baloo-bhaijaan-2/latin-600.css';
import './styles/tokens.css';
import './styles/bundle.css';
import './styles/app.css';
import { App } from './app.jsx';

if (import.meta.env.DEV) {
  const th = new URLSearchParams(location.hash.slice(1)).get('theme');
  if (th) localStorage.setItem('fz.theme', JSON.stringify(th));
}

render(<App />, document.getElementById('app'));
