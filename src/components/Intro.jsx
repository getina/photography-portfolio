import { useEffect, useRef, useState } from 'react';
import './Intro.css';

function CameraSVG({ phase }) {
  return (
    <svg
      viewBox="0 0 300 220"
      className={`camera-svg phase-${phase}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Lens glass gradient — blue-teal like the reference */}
        <radialGradient id="lensGlass" cx="38%" cy="32%" r="65%">
          <stop offset="0%"   stopColor="#d4eef8" />
          <stop offset="32%"  stopColor="#78c4d8" />
          <stop offset="72%"  stopColor="#2e8cb4" />
          <stop offset="100%" stopColor="#196080" />
        </radialGradient>
        {/* Body shading */}
        <radialGradient id="bodyShade" cx="50%" cy="18%" r="78%">
          <stop offset="0%"   stopColor="#636f80" />
          <stop offset="100%" stopColor="#48596a" />
        </radialGradient>
        {/* Lens flash overlay */}
        <radialGradient id="lensFlashGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        {/* Diagonal hatch for grip */}
        <pattern id="hatch" width="5" height="5"
          patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#1c2830" strokeWidth="2.5" />
        </pattern>
      </defs>

      {/* ── Main body ──────────────────────────────────── */}
      <rect x="12" y="68" width="276" height="126" rx="10" fill="url(#bodyShade)" />

      {/* Left grip — dark + hatched */}
      <rect x="12" y="68" width="64" height="126" rx="10" fill="#2c3844" />
      <rect x="12" y="68" width="64" height="126" rx="10" fill="url(#hatch)" opacity="0.55" />
      {/* blend seam between grip and body */}
      <rect x="66" y="68" width="12" height="126" fill="#2c3844" />

      {/* ── Top pentaprism housing ─────────────────────── */}
      <path d="M92,68 L110,36 L190,36 L208,68 Z" fill="#4c5c6e" />
      <rect x="110" y="26" width="80" height="14" rx="4" fill="#3c4c5e" />

      {/* Hot shoe */}
      <rect x="132" y="20" width="36" height="9" rx="2" fill="#212c36" />
      <rect x="138" y="22" width="24" height="5" rx="1" fill="#141e28" />

      {/* Viewfinder window */}
      <rect x="120" y="38" width="60" height="22" rx="4" fill="#141e28" />
      <rect x="124" y="41" width="52" height="16" rx="3" fill="#0a1420" />

      {/* Mode / command dial (top right) */}
      <ellipse cx="244" cy="50" rx="22" ry="15" fill="#212c38" />
      <ellipse cx="244" cy="50" rx="15" ry="10" fill="#30404e" />
      <line x1="244" y1="41" x2="244" y2="38"
        stroke="#809aaa" strokeWidth="1.5" strokeLinecap="round" />

      {/* Shutter button */}
      <circle cx="76" cy="37" r="9"  fill="#212c36" />
      <circle cx="76" cy="37" r="5.5" fill="#3a4858" />

      {/* ── Right-side circular grid (flash / speaker) ─── */}
      <circle cx="260" cy="112" r="21" fill="#384858" />
      <circle cx="260" cy="112" r="14" fill="#242e3a" />
      {[-5, 0, 5].flatMap(dy =>
        [-5, 0, 5].map(dx => (
          <circle key={`${dx},${dy}`}
            cx={260 + dx} cy={112 + dy} r="2.2" fill="#4a5a6e" />
        ))
      )}

      {/* Body top-edge highlight */}
      <rect x="13" y="69" width="274" height="5" rx="2"
        fill="rgba(255,255,255,0.10)" />

      {/* ── Lens system ───────────────────────────────── */}
      {/* Outer mounting ring — sized so r=58 keeps bottom at y=190, within body (y=194) */}
      <circle cx="150" cy="132" r="58"  fill="#181820" />
      {/* Barrel ring 1 */}
      <circle cx="150" cy="132" r="52"  fill="#20242e" />
      {/* Barrel ring 2 */}
      <circle cx="150" cy="132" r="46"  fill="#141518" />
      {/* Inner barrel */}
      <circle cx="150" cy="132" r="40"  fill="#0e0f14" />
      {/* Lens glass */}
      <circle cx="150" cy="132" r="34"  fill="url(#lensGlass)" />
      {/* Centre depth shadow */}
      <circle cx="150" cy="132" r="11"  fill="#196080" opacity="0.45" />
      {/* Main reflection blob */}
      <ellipse cx="135" cy="116" rx="14" ry="9"
        fill="rgba(255,255,255,0.48)" transform="rotate(-18,135,116)" />
      {/* Secondary glint */}
      <ellipse cx="162" cy="144" rx="7" ry="4"
        fill="rgba(255,255,255,0.20)" />

      {/* Lens flash overlay — animated on click */}
      <circle className="lens-flash-circle" cx="150" cy="132" r="34"
        fill="url(#lensFlashGrad)" />

      {/* ── Bottom edge ───────────────────────────────── */}
      <rect x="12" y="186" width="276" height="8" rx="4" fill="#364658" />

      {/* Strap lugs */}
      <rect x="3"   y="96"  width="13" height="22" rx="4" fill="#212c38" />
      <rect x="0"   y="102" width="8"  height="10" rx="2" fill="#131c28" />
      <rect x="284" y="96"  width="13" height="22" rx="4" fill="#212c38" />
      <rect x="292" y="102" width="8"  height="10" rx="2" fill="#131c28" />
    </svg>
  );
}

function playShutterSound(ctx) {
  if (!ctx || ctx.state === 'closed') return;
  try {
    // Mirror slap — low thud, bandpass ~380 Hz, 55 ms
    const mirrorGain = ctx.createGain();
    mirrorGain.gain.setValueAtTime(0.55, ctx.currentTime);
    mirrorGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.055);
    mirrorGain.connect(ctx.destination);

    const mirrorBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.055), ctx.sampleRate);
    const mirrorData = mirrorBuf.getChannelData(0);
    for (let i = 0; i < mirrorData.length; i++) mirrorData[i] = Math.random() * 2 - 1;
    const mirrorSrc = ctx.createBufferSource();
    mirrorSrc.buffer = mirrorBuf;
    const mirrorFilter = ctx.createBiquadFilter();
    mirrorFilter.type = 'bandpass';
    mirrorFilter.frequency.value = 380;
    mirrorFilter.Q.value = 0.6;
    mirrorSrc.connect(mirrorFilter);
    mirrorFilter.connect(mirrorGain);
    mirrorSrc.start(ctx.currentTime);

    // Shutter curtain — higher snap, highpass ~1.8 kHz, 40 ms later
    const snapGain = ctx.createGain();
    const snapAt = ctx.currentTime + 0.09;
    snapGain.gain.setValueAtTime(0.4, snapAt);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, snapAt + 0.04);
    snapGain.connect(ctx.destination);

    const snapBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.04), ctx.sampleRate);
    const snapData = snapBuf.getChannelData(0);
    for (let i = 0; i < snapData.length; i++) snapData[i] = Math.random() * 2 - 1;
    const snapSrc = ctx.createBufferSource();
    snapSrc.buffer = snapBuf;
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.value = 1800;
    snapSrc.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapSrc.start(snapAt);
  } catch (_) {}
}

export default function Intro({ onDone }) {
  const [phase, setPhase] = useState('idle');
  const audioCtxRef = useRef(null);
  const firedRef   = useRef(false);
  const onDoneRef  = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtxRef.current = new AC();
    return () => { audioCtxRef.current?.close(); };
  }, []);

  // Shared firing logic. fromGesture=true means we're inside a real click
  // handler, so resume() + play are allowed by the browser.
  const fire = (fromGesture) => {
    if (firedRef.current) return;
    firedRef.current = true;
    const ctx = audioCtxRef.current;
    if (fromGesture && ctx) {
      ctx.resume().then(() => playShutterSound(ctx));
    } else {
      playShutterSound(ctx); // may be silent if context still suspended
    }
    setPhase('clicking');
    setTimeout(() => setPhase('flashing'), 160);
    setTimeout(() => onDoneRef.current(), 980);
  };

  // Fallback: auto-fire at ~3 s if the user never clicks
  useEffect(() => {
    const t = setTimeout(() => fire(false), 1900);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div
        className={`intro-screen phase-${phase}`}
        onClick={() => fire(true)}
      >
        <h1 className="intro-title">Life Through My Eyes</h1>

        {/* Outer div: centering; middle div: float; inner SVG: click recoil */}
        <div className="camera-outer">
          <div className="camera-float">
            <CameraSVG phase={phase} />
          </div>
        </div>

      </div>

      {/* Full-screen flash — sibling so it's above the intro layer */}
      {phase === 'flashing' && <div className="screen-flash" />}
    </>
  );
}
