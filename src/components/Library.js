import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { extensionOf, isLikelyTextFile, TEXT_EXTENSIONS } from '../utils/paginateText';
import { decodeTextBytes } from '../utils/decodeTextBytes';
import { looksBinaryString } from '../utils/textSniff';

const RULES_SETUP_RU =
  'В консоли https://console.firebase.google.com/ выберите проект → Firestore → Правила и отдельно Storage → Правила (это не Realtime Database): вставьте текст из файлов firestore.rules и storage.rules в корне проекта и опубликуйте. Убедитесь, что раздел Storage включён. Из папки проекта: npx firebase-tools login, затем npx firebase-tools deploy --only firestore:rules,storage';

const STORAGE_CORS_HINT_RU =
  'Сообщение про CORS при POST в firebasestorage.googleapis.com почти всегда значит, что Storage вернул ошибку (часто 403 из‑за правил). Откройте Storage → Правила в консоли и опубликуйте содержимое файла storage.rules из репозитория.';

/** Текст до этого размера дублируется в Firestore, чтобы читалка не ходила в Storage с localhost (CORS/206). */
const MAX_INLINE_TEXT_BYTES = 500 * 1024;

const readFileAsTextAuto = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const buf = r.result;
      if (!(buf instanceof ArrayBuffer)) {
        resolve('');
        return;
      }
      try {
        resolve(decodeTextBytes(buf));
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });

const Library = () => {
  const { currentUser, isWriter } = useAuth();
  const [books, setBooks] = useState([]);
  const [listError, setListError] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadErr, setUploadErr] = useState('');

  useEffect(() => {
    if (!currentUser) return undefined;

    let unsub = null;
    let cancelled = false;

    const run = async () => {
      try {
        await getIdToken(currentUser, false);
      } catch (e) {
        console.warn('getIdToken', e);
      }
      if (cancelled || auth.currentUser?.uid !== currentUser.uid) return;

      const q = query(collection(db, 'books'));

      unsub = onSnapshot(
        q,
        (snap) => {
          setListError('');
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const timeMs = (ts) => {
            if (!ts) return 0;
            if (typeof ts.toMillis === 'function') return ts.toMillis();
            if (typeof ts.seconds === 'number') return ts.seconds * 1000;
            return 0;
          };
          rows.sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
          setBooks(rows);
        },
        (err) => {
          console.error(err);
          if (err.code === 'permission-denied') {
            setListError(
              `Доступ к списку книг запрещён (Firestore: permission-denied). ${RULES_SETUP_RU}`
            );
          } else if (err.code === 'failed-precondition') {
            setListError(
              'Запрос к Firestore отклонён (failed-precondition). Проверьте правила и индексы в консоли Firebase.'
            );
          } else {
            setListError(err.message || 'Не удалось загрузить список книг.');
          }
        }
      );
    };

    run();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [currentUser]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUser) return;

    if (!isWriter) {
      setUploadErr('Загружать книги могут только пользователи с ролью «Писатель».');
      return;
    }

    setUploadErr('');
    setUploadMsg('');

    if (!isLikelyTextFile(file)) {
      setUploadErr(
        `Поддерживаются текстовые форматы: ${[...TEXT_EXTENSIONS].slice(0, 8).join(', ')} и другие text/*`
      );
      return;
    }

    setUploading(true);

    try {
      const text = await readFileAsTextAuto(file);
      if (looksBinaryString(text)) {
        setUploadErr('Файл похож на двоичный. Загрузите обычный текстовый файл.');
        setUploading(false);
        return;
      }

      const bookDoc = doc(collection(db, 'books'));
      const id = bookDoc.id;
      const ext = extensionOf(file.name);
      const storagePath = `users/${currentUser.uid}/books/${id}.${ext || 'txt'}`;

      await getIdToken(currentUser, true);
      if (auth.currentUser?.uid !== currentUser.uid) {
        throw new Error('Сессия устарела. Выйдите и войдите снова.');
      }

      await uploadBytes(ref(storage, storagePath), file, {
        contentType: file.type || 'text/plain; charset=utf-8',
      });

      const title =
        (uploadTitle && uploadTitle.trim()) ||
        file.name.replace(/\.[^.]+$/, '') ||
        'Без названия';

      const bookPayload = {
        userId: currentUser.uid,
        authorEmail: currentUser.email || '',
        title,
        originalName: file.name,
        storagePath,
        fileExtension: ext,
        createdAt: serverTimestamp(),
      };
      if (file.size <= MAX_INLINE_TEXT_BYTES) {
        bookPayload.inlineText = text;
      }

      let successMsg = `«${title}» добавлена.`;
      try {
        await setDoc(bookDoc, bookPayload);
        if (bookPayload.inlineText) {
          successMsg +=
            ' Текст также сохранён в базе — чтение без запроса к Storage (удобно на localhost).';
        }
      } catch (docErr) {
        if (bookPayload.inlineText) {
          const withoutInline = { ...bookPayload };
          delete withoutInline.inlineText;
          await setDoc(bookDoc, withoutInline);
          successMsg +=
            ' Текст слишком большой для одного документа Firestore — файл только в Storage; при CORS на localhost настройте бакет (storage-cors.json в корне проекта).';
        } else {
          throw docErr;
        }
      }

      setUploadTitle('');
      setUploadMsg(successMsg);
    } catch (err) {
      console.error(err);
      const code = err?.code;
      const msg = String(err?.message || err || '');
      const looksNetworkCors = /cors|preflight|xmlhttprequest|err_failed|network error|failed to fetch/i.test(
        msg
      );

      if (code === 'permission-denied') {
        setUploadErr(`Firestore отклонил сохранение книги. ${RULES_SETUP_RU}`);
      } else if (
        code === 'storage/unauthorized' ||
        code === 'storage/permission-denied' ||
        code === 'storage/retry-limit-exceeded'
      ) {
        setUploadErr(`Firebase Storage отклонил загрузку. ${STORAGE_CORS_HINT_RU} ${RULES_SETUP_RU}`);
      } else if (looksNetworkCors) {
        setUploadErr(`${STORAGE_CORS_HINT_RU} ${RULES_SETUP_RU}`);
      } else {
        setUploadErr(msg || 'Ошибка загрузки.');
      }
    } finally {
      setUploading(false);
    }
  };

  const removeBook = async (b) => {
    if (!currentUser) return;
    if (b.userId !== currentUser.uid) {
      window.alert('Удалить можно только свою книгу.');
      return;
    }
    if (!window.confirm(`Удалить «${b.title}»? Прогресс чтения будет сброшен при следующем открытии.`)) {
      return;
    }
    try {
      await deleteObject(ref(storage, b.storagePath));
    } catch (err) {
      console.warn(err);
    }
    try {
      await deleteDoc(doc(db, 'books', b.id));
    } catch (err) {
      console.error(err);
    }
    try {
      await deleteDoc(doc(db, 'readingProgress', `${currentUser.uid}_${b.id}`));
    } catch (err) {
      console.warn(err);
    }
  };

  const extHint = [...TEXT_EXTENSIONS].slice(0, 12).join(', ');

  return (
    <main className="library-page">
      <section className={`hero-card card ${isWriter ? 'hero-card--with-upload' : 'hero-card--reader-only'}`}>
        <div className="hero-card__text">
          <h1 className="hero-title">Каталог книг</h1>
          <p className="muted">
            {isWriter
              ? 'Вы вошли как писатель: добавляйте книги в общий каталог. Все авторизованные читатели видят все произведения. Прогресс чтения сохраняется для каждого пользователя.'
              : 'Вы вошли как читатель: ниже все книги из каталога. Прогресс страницы сохраняется для вашего аккаунта.'}
          </p>
        </div>
        {isWriter && (
          <div className="hero-card__upload">
            <label className="upload-zone">
              <input
                type="file"
                accept=".txt,.text,.md,.markdown,.csv,.json,.xml,.html,.htm,.log,.yaml,.yml,.ini,.tsv,.svg,text/*"
                className="upload-zone__input"
                onChange={handleFile}
                disabled={uploading}
              />
              <span className="upload-zone__label">
                {uploading ? 'Загрузка…' : 'Выбрать текстовый файл'}
              </span>
              <span className="upload-zone__hint">Например: {extHint}…</span>
            </label>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="label" htmlFor="book-title">
                Название (необязательно)
              </label>
              <input
                id="book-title"
                className="input"
                type="text"
                placeholder="Как отображать в списке"
                value={uploadTitle}
                onChange={(ev) => setUploadTitle(ev.target.value)}
                disabled={uploading}
              />
            </div>
            {uploadErr && <p className="error-text">{uploadErr}</p>}
            {uploadMsg && <p className="success-text">{uploadMsg}</p>}
          </div>
        )}
      </section>

      {listError && <p className="error-text">{listError}</p>}

      <section className="book-grid" aria-label="Список книг">
        {books.length === 0 && !listError ? (
          <div className="empty-state card">
            <p>
              {isWriter
                ? 'Пока нет книг в каталоге. Загрузите первый файл выше.'
                : 'Пока нет книг в каталоге. Зайдите позже или попросите писателя добавить произведение.'}
            </p>
          </div>
        ) : (
          books.map((b) => (
            <article key={b.id} className="book-tile card">
              <div className="book-tile__body">
                <h2 className="book-tile__title">{b.title}</h2>
                <p className="book-tile__meta muted">{b.originalName}</p>
                <p className="book-tile__author muted">
                  Автор:{' '}
                  {b.userId === currentUser?.uid
                    ? 'вы'
                    : b.authorEmail || b.userId?.slice(0, 8) + '…' || '—'}
                </p>
              </div>
              <div className="book-tile__actions">
                <Link to={`/read/${b.id}`} className="btn">
                  Читать
                </Link>
                {b.userId === currentUser?.uid && (
                  <button type="button" className="btn btn--danger-outline" onClick={() => removeBook(b)}>
                    Удалить
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
};

export default Library;
