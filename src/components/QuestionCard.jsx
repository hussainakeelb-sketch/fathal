import { useEffect, useState } from 'preact/hooks';
import { t, to } from '../i18n/index.js';
import { Icon } from './Icon.jsx';
import { AudioPlayer } from './AudioPlayer.jsx';

function QuestionImage({ src }) {
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setState('loading'), [src]);
  return (
    <div class={`fz-media qmedia${state === 'loading' ? ' is-loading' : ''}${state === 'error' ? ' is-error' : ''}`}>
      {state === 'error' ? (
        <>
          <Icon name="alert" style={{ width: '40px', height: '40px' }} />
          <span>{t('q.image.error')}</span>
          <button class="fz-btn" onClick={() => { setState('loading'); setAttempt(attempt + 1); }}>
            <Icon name="refresh" />{t('err.retry')}
          </button>
        </>
      ) : (
        <img
          key={attempt}
          // إذا الصورة جاهزة من التحميل المسبق، حدث onLoad ممكن ما يوصل
          ref={(el) => el && el.complete && el.naturalWidth > 0 && state === 'loading' && setState('ok')}
          src={attempt ? `${src}${src.includes('?') ? '&' : '?'}r=${attempt}` : src}
          alt={t('q.image')}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          style={state === 'loading' ? { opacity: 0 } : null}
        />
      )}
    </div>
  );
}

export function Verdict({ verdict, teams }) {
  if (!verdict) return null;
  if (verdict.type === 'ok') return <span class="fz-verdict fz-verdict--ok"><Icon name="check" />{t('q.verdict.ok', { p: verdict.points })}</span>;
  if (verdict.type === 'no') return <span class="fz-verdict fz-verdict--no"><Icon name="x" />{t('q.verdict.no', { to: to(teams[verdict.team]) })}</span>;
  return <span class="fz-verdict fz-verdict--no"><Icon name="x" />{t('q.verdict.none')}</span>;
}

// كارت السؤال: الرأس (الشارات والعداد)، النص، الوسائط، والجواب المخفي ورا زر
export function QuestionCard({ chips, timer, q, revealed, onReveal, onReport, verdict, teams, cardClass = '', cardStyle }) {
  return (
    <section class={`fz-qcard qcard ${cardClass}`} style={cardStyle} aria-live="polite">
      <div class="fz-qcard__head">
        {chips}
        <div class="grow" />
        {timer}
      </div>
      <p class="fz-qcard__q">{q.q}</p>
      {q.t === 'image' && q.m && <QuestionImage src={q.m} />}
      {q.t === 'audio' && q.m && <AudioPlayer src={q.m} />}
      {q.t !== 'image' && <div class="grow" />}
      {revealed ? (
        <div class="fz-answer fz-answer--shown is-flipping">
          <div>
            <div class="fz-answer__label">{t('q.answer')}</div>
            <div class="fz-answer__text">{q.a}</div>
          </div>
          <Verdict verdict={verdict} teams={teams} />
          {onReport && (
            <button class="fz-btn fz-btn--ghost report-btn" onClick={onReport}>
              <Icon name="flag" />{t('report.button')}
            </button>
          )}
        </div>
      ) : (
        <div class="fz-answer fz-answer--hidden">
          <span class="fz-answer__label">{t('q.answer.hidden')}</span>
          <Verdict verdict={verdict} teams={teams} />
          <button class="fz-btn fz-btn--ghost" onClick={onReveal}><Icon name="eye" />{t('q.reveal')}</button>
        </div>
      )}
    </section>
  );
}
