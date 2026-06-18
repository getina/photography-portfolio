import { useState, useEffect, useRef } from 'react';
import './PhotoPanel.css';

function Lightbox({ photos, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;
  const touchStartX = useRef(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft'  && hasPrev) setIndex(i => i - 1);
      if (e.key === 'ArrowRight' && hasNext) setIndex(i => i + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      didSwipe.current = true;
      if (dx < 0 && hasNext) setIndex(i => i + 1);
      if (dx > 0 && hasPrev) setIndex(i => i - 1);
    }
    touchStartX.current = null;
  };
  const handleClose = () => {
    if (didSwipe.current) { didSwipe.current = false; return; }
    onClose();
  };

  return (
    <div className="lightbox" onClick={handleClose} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-img-wrap">
          <img src={photo.src} alt="" />
          <button className="lightbox-close" onClick={onClose}>×</button>
          {hasPrev && (
            <button className="lightbox-prev" onClick={() => setIndex(i => i - 1)}>‹</button>
          )}
          {hasNext && (
            <button className="lightbox-next" onClick={() => setIndex(i => i + 1)}>›</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PhotoPanel({ location, onClose }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    setLightboxIndex(null);
  }, [location]);

  return (
    <>
      <div className={`photo-panel ${location ? 'open' : ''}`}>
        {location && (
          <>
            <div className="panel-header">
              <div className="panel-title">
                <h2>{location.name}</h2>
                <p>{location.subtitle}</p>
              </div>
              <button className="panel-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            <div className="photo-grid">
              {location.photos.map((photo, i) => (
                <button
                  key={photo.id}
                  className="photo-item"
                  onClick={() => setLightboxIndex(i)}
                >
                  <img src={photo.src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={location.photos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
