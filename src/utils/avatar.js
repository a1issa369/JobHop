import { supabase } from '../lib/supabaseClient';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB (pre-resize cap on what we'll even try to read)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Every avatar in the app renders at 128px or smaller (the biggest is the
// 32x32 Tailwind unit on the profile card), so there's no reason to ever
// store - and have every viewer download - a multi-megabyte, multi-thousand
// -pixel photo straight off someone's phone. Downscaled + recompressed
// client-side before upload: an 8MB phone photo becomes a ~30-80KB JPEG.
const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;

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

// Downscales + recompresses a static image via an offscreen canvas. Skips
// GIFs entirely (canvas drawImage only grabs a single frame, which would
// silently kill any animation) and skips anything already small enough that
// shrinking it further isn't worth the recompression generation-loss.
async function resizeImage(file) {
  if (file.type === 'image/gif') return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 300 * 1024) {
    bitmap.close?.();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  // If canvas.toBlob ever fails (unsupported in some embedded webviews),
  // fall back to the original file rather than blocking the upload.
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

export async function uploadAvatar(userId, file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: { message: 'Only JPG, PNG, WEBP, or GIF images are allowed.' } };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: { message: 'Image must be under 5MB.' } };
  }

  const resized = await resizeImage(file);

  const path = avatarStoragePath(userId, resized);
  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, resized, { contentType: resized.type, upsert: true });
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
