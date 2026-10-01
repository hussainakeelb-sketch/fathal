import { Icon } from './Icon.jsx';
import { t } from '../i18n/index.js';

export const NAME_MAX = 20;

export function TeamNameField({ id, team, label, value, error, onInput, onEnter, inputRef }) {
  const msgId = `${id}-msg`;
  return (
    <div class={`fz-field${error ? ' is-error' : ''}`}>
      <label class="fz-field__label" for={id}>
        <span class={`fz-sym-${team}`} aria-hidden="true">{team === 'a' ? '◆' : '●'}</span>
        {label}
      </label>
      <div class="fz-field__box">
        <input
          id={id}
          ref={inputRef}
          value={value}
          maxLength={NAME_MAX}
          placeholder={t('teams.placeholder')}
          autocomplete="off"
          enterkeyhint="next"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={msgId}
          onInput={(e) => onInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        <span class="fz-field__count" aria-hidden="true">{value.length}/{NAME_MAX}</span>
      </div>
      <span class="fz-field__msg" id={msgId}>
        {error && <Icon name="alert" />}
        {error || t('teams.hint')}
      </span>
    </div>
  );
}
