import { stripBom } from './textSniff';

function countCyrillic(str) {
  let n = 0;
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    if ((c >= 0x0400 && c <= 0x04ff) || (c >= 0x0500 && c <= 0x052f)) n += 1;
  }
  return n;
}

function countReplacement(str) {
  let n = 0;
  for (let i = 0; i < str.length; i += 1) {
    if (str.charCodeAt(i) === 0xfffd) n += 1;
  }
  return n;
}

/**
 * Декодирует байты .txt: UTF-8, UTF-16 с BOM или Windows-1251 (частый случай для русских файлов из Блокнота).
 */
export function decodeTextBytes(input) {
  let u8;
  if (input instanceof ArrayBuffer) {
    u8 = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    u8 = input;
  } else {
    u8 = new Uint8Array(input);
  }

  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return stripBom(new TextDecoder('utf-8').decode(u8.subarray(3)));
  }
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return stripBom(new TextDecoder('utf-16le').decode(u8.subarray(2)));
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return stripBom(new TextDecoder('utf-16be').decode(u8.subarray(2)));
  }

  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(u8);

  let cp1251 = utf8;
  try {
    cp1251 = new TextDecoder('windows-1251').decode(u8);
  } catch {
    return stripBom(utf8);
  }

  const cU = countCyrillic(utf8);
  const cC = countCyrillic(cp1251);
  const rU = countReplacement(utf8);
  const rC = countReplacement(cp1251);

  if (cC > cU) return stripBom(cp1251);
  if (cU > cC) return stripBom(utf8);
  if (rC < rU) return stripBom(cp1251);
  return stripBom(utf8);
}
