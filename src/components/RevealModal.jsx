import { t } from '../i18n/index.js';
import { Modal } from './Modal.jsx';

// كشف الجواب دائماً وراه تأكيد، لأن الجهاز ممكن يكون موصول بالتلفزيون
export function RevealModal({ onConfirm, onClose }) {
  return (
    <Modal
      icon="eye"
      iconStyle={{ background: 'var(--surface-brand)', color: 'var(--text-on-brand)' }}
      title={t('q.reveal.title')}
      body={t('q.reveal.body')}
      onClose={onClose}
      actions={
        <>
          <button class="fz-btn fz-btn--primary" onClick={onConfirm}>{t('q.reveal')}</button>
          <button class="fz-btn" onClick={onClose}>{t('q.reveal.cancel')}</button>
        </>
      }
    />
  );
}
