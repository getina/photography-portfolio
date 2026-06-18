import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Stars } from '@react-three/drei';
import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';

const RADIUS = 1;
const CAM_DEFAULT = new THREE.Vector3(0, 0.4, window.innerWidth <= 768 ? 4.8 : 3);
const CAM_ZOOMED_DIST = 1.9;

// ── Day / Night overlay ───────────────────────────────────────────────────────

function getSunDirection() {
  const now  = new Date();
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  const doy   = Math.floor((now - start) / 86_400_000);
  const decl  = -23.45 * Math.cos((2 * Math.PI * (doy + 10)) / 365); // solar declination °
  const lngSun = (12 - utcH) * 15; // subsolar longitude (0° at UTC noon)
  // Use the same coordinate system as latLngToVec3
  const phi   = (lngSun + 180) * (Math.PI / 180);
  const theta = (90 - decl)    * (Math.PI / 180);
  return new THREE.Vector3(
    -Math.cos(phi) * Math.sin(theta),
     Math.cos(theta),
     Math.sin(phi) * Math.sin(theta),
  ).normalize();
}

const NIGHT_VERT = `
  varying vec3 vWorldNormal;
  void main() {
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NIGHT_FRAG = `
  uniform vec3 sunDir;
  varying vec3 vWorldNormal;
  void main() {
    float cosA  = dot(vWorldNormal, normalize(sunDir));
    float night = smoothstep(0.08, -0.08, cosA); // 0 = day, 1 = night
    gl_FragColor = vec4(0.0, 0.01, 0.08, night * 0.70);
  }
`;

function DayNightOverlay() {
  const matRef  = useRef();
  const uniforms = useMemo(() => ({ sunDir: { value: getSunDirection() } }), []);

  useEffect(() => {
    const tick = () => {
      if (matRef.current) uniforms.sunDir.value.copy(getSunDirection());
    };
    const id = setInterval(tick, 60_000); // recalculate every minute
    return () => clearInterval(id);
  }, [uniforms]);

  return (
    <mesh renderOrder={1}>
      <sphereGeometry args={[RADIUS * 1.001, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={NIGHT_VERT}
        fragmentShader={NIGHT_FRAG}
      />
    </mesh>
  );
}

function latLngToVec3(lat, lng, r = RADIUS) {
  const phi = (lng + 180) * (Math.PI / 180);
  const theta = (90 - lat) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function useWorldTexture() {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/world-110m.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((world) => {
        if (cancelled) return;

        const W = 2048, H = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Ocean fill
        ctx.fillStyle = '#7ec8e3';
        ctx.fillRect(0, 0, W, H);

        const projection = d3
          .geoEquirectangular()
          .scale(W / (2 * Math.PI))
          .translate([W / 2, H / 2]);
        const path = d3.geoPath().projection(projection).context(ctx);

        // Land fill
        const land = topojson.feature(world, world.objects.land);
        ctx.beginPath();
        path(land);
        ctx.fillStyle = '#a8d5a2';
        ctx.fill();

        // Country borders
        const borders = topojson.mesh(
          world,
          world.objects.countries,
          (a, b) => a !== b,
        );
        ctx.beginPath();
        path(borders);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Coastline outline
        ctx.beginPath();
        path(land);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 0.7;
        ctx.stroke();

        const tex = new THREE.CanvasTexture(canvas);
        // Tell Three.js the canvas is in sRGB so it doesn't mangle the colors
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        setTexture(tex);
      })
      .catch((err) => {
        console.error('Globe texture failed to load:', err);
      });

    return () => { cancelled = true; };
  }, []);

  return texture;
}

function GlobeMesh({ texture }) {
  const matRef = useRef();

  // Update the material's map when the texture arrives without remounting
  useEffect(() => {
    if (!matRef.current) return;
    if (texture) {
      matRef.current.map = texture;
      matRef.current.color.set(0xffffff);
    } else {
      matRef.current.map = null;
      matRef.current.color.set('#7ec8e3');
    }
    matRef.current.needsUpdate = true;
  }, [texture]);

  return (
    <mesh>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial
        ref={matRef}
        color="#7ec8e3"
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function Pin({ location, onSelect, isSelected }) {
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const scaleTarget = useRef(1);

  const position = useMemo(
    () => latLngToVec3(location.lat, location.lng, RADIUS + 0.005),
    [location],
  );

  const quaternion = useMemo(() => {
    const normal = position.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(up, normal);
    return q;
  }, [position]);

  useEffect(() => {
    scaleTarget.current = isSelected ? 1.6 : hovered ? 1.3 : 1;
  }, [isSelected, hovered]);

  useFrame(() => {
    if (!groupRef.current) return;
    const s = groupRef.current.scale.x;
    const target = scaleTarget.current;
    if (Math.abs(s - target) > 0.001) {
      groupRef.current.scale.setScalar(s + (target - s) * 0.15);
    }
  });

  const color = isSelected ? '#ff3333' : hovered ? '#ff5050' : '#ff6b6b';

  return (
    <group
      ref={groupRef}
      position={position}
      quaternion={quaternion}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(location);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh position={[0, 0.022, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.044, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.014, 16, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>

      {hovered && (
        <Html position={[0, 0.1, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(255,255,255,0.92)',
            color: '#1a1a2e',
            padding: '5px 10px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontFamily: 'sans-serif',
            textTransform: 'lowercase',
          }}>
            {location.name}
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraTracker({ onCamMove }) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const sphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(0, 0, 0), RADIUS), []);

  useEffect(() => {
    const canvas = gl.domElement;

    const getLatLng = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const target = new THREE.Vector3();
      if (!raycaster.ray.intersectSphere(sphere, target)) return null;
      const d = target.normalize();
      const lat = 90 - Math.acos(Math.max(-1, Math.min(1, d.y))) * (180 / Math.PI);
      const lngRaw = Math.atan2(d.z, -d.x) * (180 / Math.PI) - 180;
      const lng = ((lngRaw + 180) % 360 + 360) % 360 - 180;
      return { lat, lng };
    };

    const onMouseMove = (e) => {
      const result = getLatLng(e.clientX, e.clientY);
      if (result) onCamMove(result);
    };
    const onTouchMoveCoords = (e) => {
      if (e.touches.length !== 1) return;
      const result = getLatLng(e.touches[0].clientX, e.touches[0].clientY);
      if (result) onCamMove(result);
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchmove', onTouchMoveCoords, { passive: true });
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchmove', onTouchMoveCoords);
    };
  }, [camera, gl, raycaster, sphere, onCamMove]);

  return null;
}

function GlobeScene({ locations, selectedLocation, onPinSelect, onCamMove }) {
  const { camera, gl } = useThree();
  const camTargetRef = useRef(CAM_DEFAULT.clone());
  const texture = useWorldTexture();
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const spherical = useRef(new THREE.Spherical().setFromVector3(CAM_DEFAULT));

  useEffect(() => {
    camera.position.copy(CAM_DEFAULT);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    if (selectedLocation) {
      camTargetRef.current = latLngToVec3(
        selectedLocation.lat,
        selectedLocation.lng,
        CAM_ZOOMED_DIST,
      );
    } else {
      // Zoom back out in the current direction without rotating
      const defaultDist = CAM_DEFAULT.length();
      camTargetRef.current = camera.position.clone().normalize().multiplyScalar(defaultDist);
    }
  }, [selectedLocation, camera]);

  useFrame(() => {
    const dist = camera.position.distanceTo(camTargetRef.current);
    if (dist > 0.005) {
      camera.position.lerp(camTargetRef.current, 0.055);
    }
    camera.lookAt(0, 0, 0);
  });

  // Manual orbit via mouse drag
  useEffect(() => {
    const canvas = gl.domElement;

    const onDown = (e) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      spherical.current.setFromVector3(camera.position);
    };
    const onMove = (e) => {
      if (!isDragging.current) return;
      const dx = (e.clientX - dragStart.current.x) * 0.005;
      const dy = (e.clientY - dragStart.current.y) * 0.005;
      dragStart.current = { x: e.clientX, y: e.clientY };
      spherical.current.theta -= dx;
      spherical.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.current.phi - dy));
      const r = camera.position.length();
      camera.position
        .setFromSpherical(spherical.current)
        .multiplyScalar(r / spherical.current.radius);
      camTargetRef.current = camera.position.clone();
    };
    const onUp = () => { isDragging.current = false; };
    const onWheel = (e) => {
      e.preventDefault();
      const r = camera.position.length();
      const newR = Math.max(1.5, Math.min(5, r + e.deltaY * 0.003));
      camera.position.normalize().multiplyScalar(newR);
      camTargetRef.current = camera.position.clone();
    };

    const pinchDistRef = { current: null };

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
        isDragging.current = false;
        return;
      }
      if (e.touches.length !== 1) return;
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      spherical.current.setFromVector3(camera.position);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchDistRef.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);
        const scale = pinchDistRef.current / newDist;
        pinchDistRef.current = newDist;
        const r = camera.position.length();
        const newR = Math.max(1.5, Math.min(5, r * scale));
        camera.position.normalize().multiplyScalar(newR);
        camTargetRef.current = camera.position.clone();
        return;
      }
      if (!isDragging.current || e.touches.length !== 1) return;
      const dx = (e.touches[0].clientX - dragStart.current.x) * 0.005;
      const dy = (e.touches[0].clientY - dragStart.current.y) * 0.005;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      spherical.current.theta -= dx;
      spherical.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.current.phi - dy));
      const r = camera.position.length();
      camera.position
        .setFromSpherical(spherical.current)
        .multiplyScalar(r / spherical.current.radius);
      camTargetRef.current = camera.position.clone();
    };
    const onTouchEnd = () => {
      isDragging.current = false;
      pinchDistRef.current = null;
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [camera, gl]);

  return (
    <>
      {/* Background colour must be set inside the scene, not on the HTML element */}
      <color attach="background" args={['#0f1628']} />

      <Stars radius={80} depth={50} count={6000} factor={5} saturation={0} />

      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 4, 5]} intensity={1.0} />
      <directionalLight position={[-3, -2, -3]} intensity={0.2} />

      <GlobeMesh texture={texture} />
      <DayNightOverlay />

      {/* Atmosphere halo */}
      <mesh>
        <sphereGeometry args={[RADIUS * 1.025, 32, 32]} />
        <meshStandardMaterial
          color="#b8e4ff"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {locations.map((loc) => (
        <Pin
          key={loc.id}
          location={loc}
          onSelect={onPinSelect}
          isSelected={selectedLocation?.id === loc.id}
        />
      ))}

      {onCamMove && <CameraTracker onCamMove={onCamMove} />}
    </>
  );
}

export default function Globe({ locations, selectedLocation, onPinSelect, onCamMove }) {
  return (
    <Canvas
      camera={{ fov: 42, near: 0.1, far: 300, position: [0, 0.4, 3] }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <GlobeScene locations={locations} selectedLocation={selectedLocation} onPinSelect={onPinSelect} onCamMove={onCamMove} />
    </Canvas>
  );
}
