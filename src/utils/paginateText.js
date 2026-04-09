import { stripBom } from './textSniff';

export { stripBom } from './textSniff';

/**
 * Split plain text into pages by word count, keeping paragraph boundaries when possible.
 */
export function paginateText(text, wordsPerPage = 280) {
  const normalized = stripBom(text.replace(/\r\n/g, '\n').trim());
  if (!normalized) return [''];

  const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const pages = [];
  let bufferParas = [];
  let wordsInBuffer = 0;

  const flush = () => {
    if (bufferParas.length) {
      pages.push(bufferParas.join('\n\n'));
      bufferParas = [];
      wordsInBuffer = 0;
    }
  };

  const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

  for (const para of paragraphs) {
    const n = wordCount(para);

    if (n > wordsPerPage) {
      flush();
      const w = para.split(/\s+/).filter(Boolean);
      for (let i = 0; i < w.length; i += wordsPerPage) {
        pages.push(w.slice(i, i + wordsPerPage).join(' '));
      }
      continue;
    }

    if (wordsInBuffer + n > wordsPerPage && wordsInBuffer > 0) {
      flush();
    }

    bufferParas.push(para);
    wordsInBuffer += n;
  }

  flush();
  return pages.length ? pages : [normalized];
}

export const TEXT_EXTENSIONS = new Set([
  'txt', 'text', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm',
  'log', 'rtf', 'yaml', 'yml', 'ini', 'cfg', 'tsv', 'svg',
]);

export function extensionOf(filename) {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

export function isLikelyTextFile(file) {
  const ext = extensionOf(file.name);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (file.type && file.type.startsWith('text/')) return true;
  return false;
}
