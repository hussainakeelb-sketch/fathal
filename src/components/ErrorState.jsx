import { t } from '../i18n/index.js';
import { Icon } from './Icon.jsx';

// حالة الخطأ: ماكو إنترنت، أو فشل تحميل الأسئلة
export function ErrorState({ error, onRetry }) {
  const offline = error?.offline || !navigator.onLine;
  return (
    <div class="fz-state center" role="alert">
      <div
        class="fz-state__icon"
        style={offline ? { background: 'var(--warning)', color: 'var(--on-warning)' } : { background: 'var(--danger)', color: 'var(--on-danger)' }}
      >
        <Icon name={offline ? 'wifiOff' : 'alert'} />
      </div>
      <h1 class="fz-state__title">{offline ? t('err.net.title') : t('err.load.title')}</h1>
      <p class="fz-state__body">{offline ? t('err.net.body') : t('err.load.body')}</p>
      <button class="fz-btn fz-btn--primary" onClick={onRetry}>{t('err.retry')}</button>
    </div>
  );
}
