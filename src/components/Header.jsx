import { t } from '../i18n/index.js';
import { Icon } from './Icon.jsx';

export function Logo({ style }) {
  return (
    <div class="logo" style={style}>
      {t('brand')}<span>؟</span>
    </div>
  );
}

// الهيدر: الشعار، ورجوع (اختياري)، وأي أزرار إضافية، والصوت، والوضع
export function Header({ prefs, onBack, children }) {
  const { theme, toggleTheme, muted, toggleMuted } = prefs;
  return (
    <header class="hd">
      <Logo />
      <div class="sp" />
      {onBack && (
        <button class="fz-btn fz-btn--ghost" onClick={onBack}>
          <span class="flip"><Icon name="arrow" /></span>
          {t('header.back')}
        </button>
      )}
      {children}
      <button
        class="fz-btn fz-btn--icon fz-btn--ghost"
        aria-label={muted ? t('header.unmute') : t('header.mute')}
        aria-pressed={muted}
        onClick={toggleMuted}
      >
        <Icon name={muted ? 'volumeOff' : 'volume'} />
      </button>
      <button
        class="fz-btn fz-btn--icon fz-btn--ghost"
        aria-label={theme === 'dark' ? t('header.light') : t('header.dark')}
        onClick={toggleTheme}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
    </header>
  );
}
