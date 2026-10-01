import { useState } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { Modal } from './Modal.jsx';
import { Icon } from './Icon.jsx';

const REASONS = ['wrong_answer', 'inappropriate', 'media', 'other'];
const API = import.meta.env.VITE_REPORT_URL || '/api/report';

// نافذة "إبلاغ عن خطأ": البلاغ يروح للسيرفر، والروبوت يراجعه ويصلح السؤال
export function ReportModal({ q, cat, onClose }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState('form'); // form | sending | done
  const [error, setError] = useState('');

  const needNote = reason === 'other' && !note.trim();
  const hasMedia = q.t !== 'text';

  const send = async () => {
    if (!reason) return;
    if (needNote) return setError(t('report.note.required'));
    setState('sending');
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qid: q.id, cat, q: q.q, a: q.a, reason, note: note.trim() }),
      });
      if (res.status === 429) throw new Error('limit');
      if (!res.ok) throw new Error('net');
      setState('done');
    } catch (e) {
      setState('form');
      setError(e.message === 'limit' ? t('report.err.limit') : t('report.err.net'));
    }
  };

  if (state === 'done') {
    return (
      <Modal
        icon="check"
        iconStyle={{ background: 'var(--success)', color: 'var(--on-success)' }}
        title={t('report.done.title')}
        body={t('report.done.body')}
        onClose={onClose}
        actions={<button class="fz-btn fz-btn--primary" onClick={onClose}>{t('report.done.close')}</button>}
      />
    );
  }

  return (
    <Modal
      icon="flag"
      iconStyle={{ background: 'var(--warning)', color: 'var(--on-warning)' }}
      title={t('report.title')}
      body={t('report.body')}
      onClose={onClose}
      actions={
        <>
          <button
            class={`fz-btn fz-btn--primary${state === 'sending' ? ' is-loading' : ''}`}
            disabled={!reason}
            aria-busy={state === 'sending' ? 'true' : undefined}
            onClick={send}
          >
            {t('report.send')}
          </button>
          <button class="fz-btn" onClick={onClose}>{t('report.cancel')}</button>
        </>
      }
    >
      <div class="report-reasons" role="radiogroup" aria-label={t('report.body')}>
        {REASONS.filter((r) => r !== 'media' || hasMedia).map((r) => (
          <label class={`report-reason${reason === r ? ' is-selected' : ''}`}>
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => { setReason(r); setError(''); }} />
            <span>{t(`report.reason.${r}`)}</span>
          </label>
        ))}
      </div>
      {reason && (
        <div class={`fz-field${error && needNote ? ' is-error' : ''}`}>
          <label class="fz-field__label" for="report-note">
            {reason === 'other' ? t('report.note') : t('report.note.optional')}
          </label>
          <div class="fz-field__box">
            <input
              id="report-note"
              value={note}
              maxLength={300}
              placeholder={t('report.note.placeholder')}
              onInput={(e) => setNote(e.currentTarget.value)}
            />
          </div>
        </div>
      )}
      {error && (
        <p class="fz-field__msg report-error" role="alert"><Icon name="alert" />{error}</p>
      )}
    </Modal>
  );
}
