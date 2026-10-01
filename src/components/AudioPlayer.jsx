import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { Icon } from './Icon.jsx';

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '--:--');

// مقطع السؤال: المقدّم يشغّله بنفسه (ما يشتغل تلقائياً)، والكتم ما يأثر عليه لأنه جزء من السؤال.
export function AudioPlayer({ src }) {
  const audio = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | playing | paused | error
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(NaN);

  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    audio.current = a;
    const on = {
      loadedmetadata: () => {
        setDur(a.duration);
        setState((s) => (s === 'loading' ? 'ready' : s));
      },
      canplay: () => setState((s) => (s === 'loading' ? 'ready' : s)),
      timeupdate: () => setPos(a.currentTime),
      play: () => setState('playing'),
      pause: () => setState((s) => (s === 'error' ? s : 'paused')),
      ended: () => setState('ready'),
      error: () => setState('error'),
    };
    for (const k in on) a.addEventListener(k, on[k]);
    a.src = src;
    return () => {
      a.pause();
      for (const k in on) a.removeEventListener(k, on[k]);
    };
  }, [src]);

  const toggle = () => {
    const a = audio.current;
    if (state === 'playing') return a.pause();
    if (a.ended || state === 'ready') a.currentTime = 0;
    a.play().catch(() => setState('error'));
  };

  const retry = () => {
    setState('loading');
    audio.current.load();
  };

  if (state === 'error') {
    return (
      <div class="fz-audio is-error" role="alert">
        <span class="fz-alert__icon" style={{ background: 'var(--danger)', color: 'var(--on-danger)' }}><Icon name="alert" /></span>
        <span class="fz-audio__msg">{t('audio.error')}</span>
        <button class="fz-btn" onClick={retry}><Icon name="refresh" />{t('err.retry')}</button>
      </div>
    );
  }

  const playing = state === 'playing';
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
  const remaining = playing || state === 'paused' ? dur - pos : dur;

  return (
    <div class="fz-audio">
      {state === 'loading' ? (
        <button class="fz-audio__play" aria-label={t('audio.loading')} aria-busy="true" disabled><span class="fz-spinner" /></button>
      ) : (
        <button class="fz-audio__play" aria-label={playing ? t('audio.pause') : t('audio.play')} onClick={toggle}>
          <Icon name={playing ? 'pause' : 'play'} filled />
        </button>
      )}
      <div class="fz-audio__track"><div class="fz-audio__fill" style={{ width: `${pct}%` }} /></div>
      <span class="fz-audio__time">{fmt(remaining)}</span>
    </div>
  );
}
