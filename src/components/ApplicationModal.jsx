import { useState } from 'react';
import { z } from 'zod';
import { STAGES } from '../utils/stageConfig';

// Only company, role, and stage are required to create a card. Everything
// else (deadline, follow-up, notes) is optional detail added later.
const schema = z.object({
  company: z.string().min(1, 'Company is required').max(100),
  role: z.string().min(1, 'Role is required').max(100),
  stage: z.string().min(1),
  deadline: z.string().optional().or(z.literal('')),
  follow_up_date: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal(''))
});

const REQUIRED_FIELDS = ['company', 'role', 'stage'];

export default function ApplicationModal({ initial, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(
    initial ?? {
      company: '',
      role: '',
      stage: 'wishlist',
      deadline: '',
      follow_up_date: '',
      notes: ''
    }
  );
  // Tracks which required fields the user has already interacted with, so
  // we don't show red outlines before they've had a chance to type anything.
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(initial?.id);

  function isEmpty(field) {
    return !String(form[field] ?? '').trim();
  }

  // A required field shows its red reminder once the user has left it blank
  // and moved on (touched), or once they've tried to submit at all.
  function showInvalid(field) {
    return REQUIRED_FIELDS.includes(field) && isEmpty(field) && (touched[field] || attempted);
  }

  function handleBlur(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setAttempted(true);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError('');
    onSave({ ...parsed.data, id: initial?.id });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card-surface w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {isEdit ? 'Edit application' : 'New application'}
          </h2>
          <button onClick={onClose} className="text-ink2 hover:text-paper" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company" required invalid={showInvalid('company')}>
              <input
                className={`input ${showInvalid('company') ? 'input-invalid' : ''}`}
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                onBlur={() => handleBlur('company')}
              />
            </Field>
            <Field label="Role" required invalid={showInvalid('role')}>
              <input
                className={`input ${showInvalid('role') ? 'input-invalid' : ''}`}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                onBlur={() => handleBlur('role')}
              />
            </Field>
          </div>

          <Field label="Stage" required invalid={showInvalid('stage')}>
            <select
              className={`input ${showInvalid('stage') ? 'input-invalid' : ''}`}
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              onBlur={() => handleBlur('stage')}
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Deadline">
              <input
                type="date"
                className="input"
                value={form.deadline ?? ''}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </Field>
            <Field label="Follow-up date">
              <input
                type="date"
                className="input"
                value={form.follow_up_date ?? ''}
                onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className="input min-h-[80px]"
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {error && <p className="text-sm text-bad">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={() => onDelete(initial.id)}
                className="text-sm text-bad hover:underline"
              >
                Delete card
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {isEdit ? 'Save changes' : 'Add card'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, required, invalid }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs text-ink2">
        {label}
        {required && <span className="text-signal">*</span>}
      </span>
      {children}
      {invalid && <span className="mt-1 block text-[11px] text-bad">{label} is required</span>}
    </label>
  );
}
