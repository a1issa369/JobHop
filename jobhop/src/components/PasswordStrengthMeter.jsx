import {
  analyzePassword,
  LEVEL_LABEL,
  LEVEL_COLOR,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
} from '../utils/password.js';

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const { level, percent, hasUpper, hasLower, hasSpecial, longEnough } = analyzePassword(password);

  return (
    <div className="mt-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-grid">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300 ease-out"
          style={{ width: `${percent}%`, backgroundColor: LEVEL_COLOR[level] }}
        />
      </div>
      <p className="mt-1 text-[11px]" style={{ color: LEVEL_COLOR[level] }}>
        {LEVEL_LABEL[level]}
      </p>
      {level !== 'strong' && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-ink2">
          <li className={longEnough ? 'text-good' : ''}>
            • {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters
          </li>
          <li className={hasUpper ? 'text-good' : ''}>• One uppercase letter</li>
          <li className={hasLower ? 'text-good' : ''}>• One lowercase letter</li>
          <li className={hasSpecial ? 'text-good' : ''}>• One special character</li>
        </ul>
      )}
    </div>
  );
}
