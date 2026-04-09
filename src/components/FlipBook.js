import React, { useCallback, useEffect, useRef, useState } from 'react';

function PageBody({ text }) {
  const blocks = text.split('\n\n').filter(Boolean);
  return (
    <div className="flip-page__body">
      {blocks.map((block, i) => (
        <p key={i} className="flip-page__para">
          {block.split('\n').map((line, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

/**
 * 3D page turn: top sheet peels away to reveal the next (or previous) page.
 */
export default function FlipBook({ pages, page, onPageCommitted, bookTitle, readerFontScale = 1 }) {
  const total = pages.length;
  const scaleStyle = { '--reader-font-scale': String(readerFontScale) };
  const [anim, setAnim] = useState(null);
  const live = useRef({ page, anim, total });
  live.current = { page, anim, total };

  const commitNext = useCallback(() => {
    if (page < total) onPageCommitted(page + 1);
  }, [page, total, onPageCommitted]);

  const commitPrev = useCallback(() => {
    if (page > 1) onPageCommitted(page - 1);
  }, [page, onPageCommitted]);

  const goNext = () => {
    if (anim || page >= total) return;
    setAnim('next');
  };

  const goPrev = () => {
    if (anim || page <= 1) return;
    setAnim('prev');
  };

  useEffect(() => {
    const onKey = (e) => {
      const { page: p, anim: a, total: t } = live.current;
      if (a) return;
      if (e.key === 'ArrowRight' && p < t) setAnim('next');
      if (e.key === 'ArrowLeft' && p > 1) setAnim('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onAnimEnd = (e) => {
    if (e.target !== e.currentTarget) return;
    if (anim === 'next') commitNext();
    else if (anim === 'prev') commitPrev();
    setAnim(null);
  };

  const idx = page - 1;
  const content = pages[idx] ?? '';

  if (!anim) {
    return (
      <div className="flip-book" style={scaleStyle}>
        <div className="flip-book__chrome">
          <div className="flip-book__spine" aria-hidden />
          <div
            className="flip-page flip-page--single"
            role="article"
            aria-label={`Страница ${page} из ${total}`}
          >
            <header className="flip-page__header">
              <span className="flip-page__title">{bookTitle}</span>
              <span className="flip-page__num">
                {page} / {total}
              </span>
            </header>
            <PageBody text={content} />
          </div>
        </div>
        <nav className="flip-book__nav" aria-label="Перелистывание">
          <button type="button" className="btn btn--ghost" onClick={goPrev} disabled={page <= 1}>
            ← Назад
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={goNext}
            disabled={page >= total}
          >
            Вперёд →
          </button>
        </nav>
      </div>
    );
  }

  if (anim === 'next') {
    const under = pages[page] ?? '';
    const top = pages[idx] ?? '';
    return (
      <div className="flip-book" style={scaleStyle}>
        <div className="flip-book__chrome">
          <div className="flip-book__spine" aria-hidden />
          <div className="flip-scene" style={{ perspective: '2200px' }}>
            <div className="flip-stack">
            <div
              className="flip-page flip-page--under"
              aria-hidden
            >
              <header className="flip-page__header">
                <span className="flip-page__title">{bookTitle}</span>
                <span className="flip-page__num">
                  {page + 1} / {total}
                </span>
              </header>
              <PageBody text={under} />
            </div>
            <div
              className="flip-page flip-page--top flip-page--anim-next"
              onAnimationEnd={onAnimEnd}
              role="presentation"
            >
              <header className="flip-page__header">
                <span className="flip-page__title">{bookTitle}</span>
                <span className="flip-page__num">
                  {page} / {total}
                </span>
              </header>
              <PageBody text={top} />
            </div>
          </div>
          </div>
        </div>
        <nav className="flip-book__nav" aria-label="Перелистывание">
          <button type="button" className="btn btn--ghost" disabled>
            ← Назад
          </button>
          <button type="button" className="btn btn--ghost" disabled>
            Вперёд →
          </button>
        </nav>
      </div>
    );
  }

  const underPrev = pages[idx - 1] ?? '';
  const topCurrent = pages[idx] ?? '';
  return (
    <div className="flip-book" style={scaleStyle}>
      <div className="flip-book__chrome">
        <div className="flip-book__spine" aria-hidden />
        <div className="flip-scene" style={{ perspective: '2200px' }}>
          <div className="flip-stack">
          <div className="flip-page flip-page--under" aria-hidden>
            <header className="flip-page__header">
              <span className="flip-page__title">{bookTitle}</span>
              <span className="flip-page__num">
                {page - 1} / {total}
              </span>
            </header>
            <PageBody text={underPrev} />
          </div>
          <div
            className="flip-page flip-page--top flip-page--anim-prev"
            onAnimationEnd={onAnimEnd}
            role="presentation"
          >
            <header className="flip-page__header">
              <span className="flip-page__title">{bookTitle}</span>
              <span className="flip-page__num">
                {page} / {total}
              </span>
            </header>
            <PageBody text={topCurrent} />
          </div>
        </div>
        </div>
      </div>
      <nav className="flip-book__nav" aria-label="Перелистывание">
        <button type="button" className="btn btn--ghost" disabled>
          ← Назад
        </button>
        <button type="button" className="btn btn--ghost" disabled>
          Вперёд →
        </button>
      </nav>
    </div>
  );
}
