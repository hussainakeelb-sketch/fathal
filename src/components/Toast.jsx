import { useEffect } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { Icon } from './Icon.jsx';

const ICONS = { success: 'check', info: 'info', danger: 'x' };
export const UNDO_MS = 5000;

// Toast وحدة بس بنفس الوقت، تختفي بعد 5 ثواني. بيها زر "تراجع" إذا onUndo موجود.
export function Toast({ toast, onUndo, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, UNDO_MS);
    return () => clearTimeout(id);
  }, [toast.key]);

  return (
    <div class="toast-layer">
      <div class={`fz-alert fz-alert--${toast.kind} fz-toast`} role="status" key={toast.key}>
        <span class="fz-alert__icon"><Icon name={ICONS[toast.kind]} /></span>
        <span class="fz-alert__text"><b>{toast.text}</b></span>
        {onUndo && (
          <button class="fz-btn fz-btn--ghost" onClick={onUndo}>{t('toast.undo')}</button>
        )}
      </div>
    </div>
  );
}
