import { supabase } from '../lib/supabaseClient';

export const MAX_RESUME_BYTES = 8 * 1024 * 1024; // 8MB

// Fixed filename per user so re-uploading always replaces (upsert) rather
// than accumulating files - the owner only ever has one resume on file.
export function resumeStoragePath(userId) {
  return `${userId}/resume.pdf`;
}

// Validates PDF-only client-side (defense in depth only - the storage
// bucket itself doesn't enforce a mime type, so this is a UX nicety, not
// the security boundary; RLS on storage.objects is what actually restricts
// who can write where).
export async function uploadResume(userId, file) {
  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!looksLikePdf) {
    return { error: { message: 'Only PDF files are allowed.' } };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { error: { message: 'Resume must be under 8MB.' } };
  }

  const path = resumeStoragePath(userId);
  const { error: uploadErr } = await supabase.storage
    .from('resumes')
    .upload(path, file, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) return { error: uploadErr };

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ resume_url: path })
    .eq('id', userId);
  if (updateErr) return { error: updateErr };

  return { path };
}

export async function removeResume(userId, path) {
  await supabase.storage.from('resumes').remove([path]);
  return supabase.from('profiles').update({ resume_url: null }).eq('id', userId);
}

// resume_url is a private storage path, not a public URL (the bucket isn't
// public), so viewing it means minting a short-lived signed URL on demand -
// this call is itself subject to the resumes_owner_or_friend_read RLS
// policy, so it only succeeds for the owner or an accepted friend.
export async function getResumeSignedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
