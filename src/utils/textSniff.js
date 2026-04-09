export function stripBom(str) {
  if (!str || str.length === 0) return str;
  if (str.charCodeAt(0) === 0xfeff) return str.slice(1);
  return str;
}

/** Reject obvious binary uploads (null bytes in sample). */
export function looksBinaryString(sample) {
  const slice = sample.slice(0, 8000);
  for (let i = 0; i < slice.length; i += 1) {
    if (slice.charCodeAt(i) === 0) return true;
  }
  return false;
}
