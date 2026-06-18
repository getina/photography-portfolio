import { useState, useEffect } from 'react';
import Globe from './components/Globe';
import PhotoPanel from './components/PhotoPanel';
import Intro from './components/Intro';
import WorldClocks from './components/WorldClocks';
import './App.css';

function formatCoords(lat, lng) {
  const latStr = `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(1)}° ${lng >= 0 ? 'E' : 'W'}`;
  return { latStr, lngStr };
}

export default function App() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showIntro, setShowIntro] = useState(true);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setLocations)
      .catch(err => console.error('Failed to load locations:', err));
  }, []);

  return (
    <div className="app">
      {/* Globe renders immediately beneath the intro so it's ready when intro fades */}
      <div className={`globe-container ${selectedLocation ? 'panel-open' : ''}`}>
        <Globe
          locations={locations}
          selectedLocation={selectedLocation}
          onPinSelect={setSelectedLocation}
          onCamMove={setCoords}
        />

        {coords && !showIntro && (
          <div className="coords-display">
            <span>{formatCoords(coords.lat, coords.lng).latStr}</span>
            <span>{formatCoords(coords.lat, coords.lng).lngStr}</span>
          </div>
        )}

        <div className="site-title">
          <h1>Life Through My Eyes</h1>
          <p>Click a pin to explore</p>
        </div>

        {selectedLocation && (
          <button
            className="zoom-out-btn"
            onClick={() => setSelectedLocation(null)}
          >
            ← Back to Globe
          </button>
        )}

        <WorldClocks />
      </div>

      <PhotoPanel
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />

      {showIntro && <Intro onDone={() => setShowIntro(false)} />}
    </div>
  );
}
