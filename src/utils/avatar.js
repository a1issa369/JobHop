import { supabase } from '../lib/supabaseClient';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function extensionFor(file) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^(jpe?g|png|webp|gif)$/.test(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  return file.type.split('/')[1] ?? 'jpg';
}

// Fixed filename per user (like resumes) so re-uploading always replaces
// rather than accumulating files.
export function avatarStoragePath(userId, file) {
  return `${userId}/avatar.${extensionFor(file)}`;
}

export async function uploadAvatar(userId, file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: { message: 'Only JPG, PNG, WEBP, or GIF images are allowed.' } };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: { message: 'Image must be under 5MB.' } };
  }

  const path = avatarStoragePath(userId, file);
  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadErr) return { error: uploadErr };

  // Unlike resumes, the avatars bucket is public - the stored value is a
  // real, directly-usable URL, not a private storage path needing a signed
  // URL on every view. The timestamp query param busts the browser's image
  // cache so a replaced photo shows up immediately instead of the old one
  // sticking around at the same URL.
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  if (updateErr) return { error: updateErr };

  return { url: avatarUrl };
}
