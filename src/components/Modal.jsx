import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon.jsx';

// نافذة تأكيد: تتسكر بـ Esc وبالضغط على الخلفية وبزر الإلغاء.
// التركيز يدخل النافذة ويبقى محبوس داخلها، ويرجع للزر الي فتحها.
export function Modal({ icon, iconStyle, title, body, actions, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const box = ref.current;
    box.querySelector('button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const items = [...box.querySelectorAll('button:not([disabled])')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div class="fz-overlay modal-layer" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fz-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <div class="fz-modal__icon" style={iconStyle}><Icon name={icon} /></div>
        <h2 class="fz-modal__title" id="modal-title">{title}</h2>
        <p class="fz-modal__body">{body}</p>
        <div class="fz-modal__actions">{actions}</div>
      </div>
    </div>
  );
}
