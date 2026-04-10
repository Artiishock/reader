import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { ref, getBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { decodeTextBytes } from '../utils/decodeTextBytes';
import { paginateText } from '../utils/paginateText';
import FlipBook from './FlipBook';

const progressId = (uid, bookId) => `${uid}_${bookId}`;

const STORAGE_READ_FAIL_RU =
  'Не удалось прочитать файл из Storage с этой страницы (браузер блокирует ответ из‑за CORS, часто при localhost и ответе 206). Загрузите книгу заново — файлы до ~500 КБ сохраняют текст в Firestore и открываются без Storage. Для больших файлов настройте CORS бакета: в Google Cloud SDK выполните gsutil cors set storage-cors.json gs://reader-27ca2.firebasestorage.app (файл storage-cors.json лежит в корне проекта).';

const FONT_SCALE_KEY = 'folioReaderFontScale';
const FONT_MIN = 0.75;
const FONT_MAX = 1.75;
const FONT_STEP = 0.1;

// flip-page__header: font 0.78rem + padding-bottom 0.65rem + margin-bottom 1.25rem + border ≈ 48px
const PAGE_HEADER_H = 48;

/**
 * Calculate words per page from the actual measured flip-page element dimensions.
 * Accounts for: header, padding, line-height, and paragraph bottom margins (1em each).
 */
function calcWordsPerPage(pageWidth, pageHeight, fontScale) {
  if (!pageWidth || !pageHeight) return 180;

  const fontPx = 18 * fontScale;
  const lineH = fontPx * 1.72;

  // Padding inside flip-page: clamp(0.75rem, 3vw, 2rem) top+bottom, clamp(0.85rem, 4vw, 2.75rem) left+right
  const padV = Math.max(12, Math.min(32, pageWidth * 0.03)) * 2;
  const padH = Math.max(13.6, Math.min(44, pageWidth * 0.04)) * 2;

  const textW = pageWidth - padH;
  const textHraw = pageHeight - PAGE_HEADER_H - padV;

  // Words per line: ~0.52em per char for Literata, ~5.5 chars/word average
  const wordsPerLine = (textW / (fontPx * 0.52)) / 5.5;

  // Rough first-pass estimate to know how many paragraphs (~40 words each) we'll have
  const roughLines = textHraw / lineH;
  const roughWords = roughLines * wordsPerLine;
  const estParas = roughWords / 40;
  // Each paragraph has margin-bottom: 1em
  const paraMarginH = estParas * fontPx;

  const textH = textHraw - paraMarginH;
  const lines = Math.floor(textH / lineH);

  // 0.85 safety margin to absorb rounding and variable word lengths
  return Math.max(40, Math.floor(lines * wordsPerLine * 0.85));
}

const BookReader = () => {
  const { bookId } = useParams();
  const { currentUser } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState('');
  const [pages, setPages] = useState([]);
  const [title, setTitle] = useState('Книга');
  const [error, setError] = useState('');
  const [fontScale, setFontScale] = useState(() => {
    const raw = parseFloat(localStorage.getItem(FONT_SCALE_KEY) || '1');
    if (!Number.isFinite(raw)) return 1;
    return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(raw * 100) / 100));
  });

  // Actual flip-page element dimensions reported by FlipBook via onPageDimsChange
  const [pageDims, setPageDims] = useState({ width: 0, height: 0 });

  const wordsPerPage = useMemo(
    () => calcWordsPerPage(pageDims.width, pageDims.height, fontScale),
    [pageDims, fontScale]
  );

  // Re-paginate whenever raw text or words-per-page changes
  useEffect(() => {
    if (!rawText) return;
    const prevTotal = pages.length || 1;
    const prevPage = currentPage;
    const newPages = paginateText(rawText, wordsPerPage);
    const fraction = (prevPage - 1) / prevTotal;
    const restored = Math.max(1, Math.min(newPages.length, Math.round(fraction * newPages.length) + 1));
    setPages(newPages);
    setCurrentPage(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawText, wordsPerPage]);

  useEffect(() => {
    localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
  }, [fontScale]);

  const bumpFont = useCallback((delta) => {
    setFontScale((s) => {
      const next = Math.round((s + delta) * 100) / 100;
      return Math.min(FONT_MAX, Math.max(FONT_MIN, next));
    });
  }, []);

  const fontPercent = useMemo(() => Math.round(fontScale * 100), [fontScale]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!currentUser || !bookId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const bookRef = doc(db, 'books', bookId);
        const snap = await getDoc(bookRef);

        if (!snap.exists()) {
          setError('Книга не найдена.');
          setRawText('');
          setLoading(false);
          return;
        }

        const data = snap.data();
        setTitle(data.title || data.originalName || 'Книга');

        let raw;
        const inline = data.inlineText;
        if (typeof inline === 'string' && inline.length > 0) {
          raw = inline;
        } else if (data.storagePath) {
          try {
            await getIdToken(currentUser, false);
            const fileRef = ref(storage, data.storagePath);
            const bytes = await getBytes(fileRef);
            raw = decodeTextBytes(bytes);
          } catch (e) {
            console.error(e);
            throw new Error(STORAGE_READ_FAIL_RU);
          }
        } else {
          throw new Error('У книги нет сохранённого текста и пути к файлу.');
        }

        const text = String(raw).replace(/\r\n/g, '\n');

        if (cancelled) return;
        setRawText(text);

        const progRef = doc(db, 'readingProgress', progressId(currentUser.uid, bookId));
        const progSnap = await getDoc(progRef);
        if (progSnap.exists()) {
          const saved = progSnap.data().page;
          if (typeof saved === 'number' && saved >= 1) {
            setCurrentPage(saved);
          } else {
            setCurrentPage(1);
          }
        } else {
          setCurrentPage(1);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          if (err?.code === 'permission-denied') {
            setError(
              'Нет доступа к Firestore (permission-denied). Скопируйте актуальные правила из файла firestore.rules в репозитории в Firebase Console → Firestore → Правила и нажмите «Опубликовать». Частая причина: правило чтения прогресса при первом открытии книги (документ ещё не создан).'
            );
          } else {
            setError(err.message || 'Ошибка загрузки.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [bookId, currentUser]);

  const saveProgress = useCallback(
    async (page) => {
      if (!currentUser || !bookId) return;
      await setDoc(doc(db, 'readingProgress', progressId(currentUser.uid, bookId)), {
        page,
        timestamp: new Date(),
        bookId,
        userId: currentUser.uid,
      });
    },
    [bookId, currentUser]
  );

  const handlePageCommitted = useCallback(
    (p) => {
      setCurrentPage(p);
      saveProgress(p);
    },
    [saveProgress]
  );

  if (loading) {
    return (
      <div className="screen-loading">
        <div className="screen-loading__inner">
          <div className="spinner" aria-hidden />
          <p>Открываем книгу…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reader-shell">
        <div className="reader-toolbar">
          <Link to="/" className="btn btn--ghost">
            ← В библиотеку
          </Link>
        </div>
        <div className="card card--narrow">
          <p className="error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!pages.length) {
    return (
      <div className="reader-shell">
        <div className="reader-toolbar">
          <Link to="/" className="btn btn--ghost">
            ← В библиотеку
          </Link>
        </div>
        <p className="muted">Пустой документ.</p>
      </div>
    );
  }

  return (
    <div className="reader-shell">
      <header className="reader-toolbar">
        <Link to="/" className="btn btn--ghost reader-toolbar__back">
          ← Библиотека
        </Link>
        <span className="reader-toolbar__title">{title}</span>
        <div className="reader-toolbar__tools">
          <div className="reader-font-tools" role="group" aria-label="Размер текста">
            <button
              type="button"
              className="btn btn--ghost btn--compact"
              onClick={() => bumpFont(-FONT_STEP)}
              disabled={fontScale <= FONT_MIN}
              aria-label="Уменьшить шрифт"
            >
              A−
            </button>
            <span className="reader-font-tools__value" aria-live="polite">
              {fontPercent}%
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--compact"
              onClick={() => bumpFont(FONT_STEP)}
              disabled={fontScale >= FONT_MAX}
              aria-label="Увеличить шрифт"
            >
              A+
            </button>
          </div>
          <span className="reader-toolbar__hint">← →</span>
        </div>
      </header>

      <FlipBook
        pages={pages}
        page={Math.min(currentPage, pages.length)}
        onPageCommitted={handlePageCommitted}
        bookTitle={title}
        readerFontScale={fontScale}
        onPageDimsChange={setPageDims}
      />
    </div>
  );
};

export default BookReader;
