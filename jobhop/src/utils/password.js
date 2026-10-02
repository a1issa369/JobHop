// "Strong" means exactly what the on-screen checklist says and nothing
// more: MIN_PASSWORD_LENGTH..MAX_PASSWORD_LENGTH characters, one uppercase,
// one lowercase, one special character. There is no hidden extra bar - once
// every displayed requirement is met, the bar is green, says "Strong," and
// the account can be created. (An earlier version silently also required
// 12+ characters and a digit before allowing submission even though neither
// was ever shown to the user - that mismatch is what this fixes.)
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 15;

// Below this many characters the bar reads "Weak" regardless of character
// variety; from here up to meeting every requirement it reads "Medium" so
// the bar visibly moves well before the password is actually valid.
const MEDIUM_THRESHOLD_LENGTH = 5;

export function analyzePassword(password) {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const longEnough = password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;

  const meetsMinimum = hasUpper && hasLower && hasSpecial && longEnough;

  const criteria = [longEnough, hasUpper, hasLower, hasSpecial];
  const metCount = criteria.filter(Boolean).length;
  const percent = password ? Math.max(10, Math.round((metCount / criteria.length) * 100)) : 0;

  let level = 'weak';
  if (meetsMinimum) {
    level = 'strong';
  } else if (password.length >= MEDIUM_THRESHOLD_LENGTH) {
    level = 'medium';
  }

  return {
    hasUpper,
    hasLower,
    hasSpecial,
    longEnough,
    meetsMinimum,
    level, // 'weak' | 'medium' | 'strong'
    percent // 0-100, drives the bar width
  };
}

export const LEVEL_LABEL = { weak: 'Weak', medium: 'Medium', strong: 'Strong' };
export const LEVEL_COLOR = { weak: '#E2574C', medium: '#F2A63A', strong: '#4CAF7D' };
