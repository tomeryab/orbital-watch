import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Satellite, Info, Pause, Play, RotateCcw, Zap, ChevronUp, ChevronDown, Settings } from 'lucide-react';

export default function Home() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationRef = useRef(null);
  const satellitesRef = useRef([]);
  const earthRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const phoneRef = useRef(null);
  const markerRef = useRef(null);
  const connectionLinesRef = useRef([]);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const isPlayingRef = useRef(true);
  const [isEarthRotating, setIsEarthRotating] = useState(true);
  const isEarthRotatingRef = useRef(true);
  const [speed, setSpeed] = useState([0.1]);
  const speedRef = useRef(0.1);
  const [satelliteCount, setSatelliteCount] = useState(128);
  const [orbitAltitude, setOrbitAltitude] = useState('MEO');
  const [baseAltitude, setBaseAltitude] = useState(4000);
  const baseAltitudeRef = useRef(4000);
  const [hoveredSatellite, setHoveredSatellite] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [currentThroughput, setCurrentThroughput] = useState('10Mbps');
  const [currentConstellation, setCurrentConstellation] = useState('QPSK');
  const [currentCodeRate, setCurrentCodeRate] = useState(0.08);
  const [satelliteVelocity, setSatelliteVelocity] = useState(0);
  const [measuredDoppler, setMeasuredDoppler] = useState(0);
  const dopplerHistoryRef = useRef([]);
  const lastDopplerUpdateRef = useRef(0);
  const [isControlsOpen, setIsControlsOpen] = useState(true);
  const [isSatelliteListOpen, setIsSatelliteListOpen] = useState(true);
  const [isChannelParamsOpen, setIsChannelParamsOpen] = useState(true);
  
  // Channel Parameters
  const [txPowerW, setTxPowerW] = useState(2000);
  const txPowerWRef = useRef(2000);
  const [satAntennaGain, setSatAntennaGain] = useState(35);
  const satAntennaGainRef = useRef(35);
  const [terminalAntennaGain, setTerminalAntennaGain] = useState(35);
  const terminalAntennaGainRef = useRef(35);
  const [noiseFigure, setNoiseFigure] = useState(3);
  const noiseFigureRef = useRef(3);
  const [channelFrequency, setChannelFrequency] = useState(20);
  const channelFrequencyRef = useRef(20);
  const [channelBW, setChannelBW] = useState(400);
  const channelBWRef = useRef(400);
  const [otherLosses, setOtherLosses] = useState(9);
  const otherLossesRef = useRef(9);
  const [satelliteDistance, setSatelliteDistance] = useState(0);
  const distanceHistoryRef = useRef([]);
  const lastDistanceUpdateRef = useRef(0);
  const [antennaType, setAntennaType] = useState('phased_array');
  const antennaTypeRef = useRef('phased_array');
  const [scanLoss, setScanLoss] = useState(0);
  const scanLossRef = useRef(0);
  const [aprAngle, setAprAngle] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create Earth group that will be rotated instead of the scene
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 4;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Stars background
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true,
      opacity: 0.8,
    });
    
    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      starsVertices.push(x, y, z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    earthGroup.add(stars);

    // Earth with realistic texture
    const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Load Earth textures
    const textureLoader = new THREE.TextureLoader();
    
    // Using NASA's Blue Marble texture
    const earthTexture = textureLoader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg');
    const bumpTexture = textureLoader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/elev_bump_4k.jpg');
    const specularTexture = textureLoader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/water_4k.png');
    
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.05,
      specularMap: specularTexture,
      specular: new THREE.Color(0x333333),
      shininess: 15,
    });
    
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.rotation.set(0, 0, 0); // Ensure Earth starts at zero rotation
    earthGroup.add(earth);
    earthRef.current = earth;
    
    // Add ambient light for full brightness
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    // Atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(1.05, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthGroup.add(atmosphere);

    // Create smartphone on USA
    const phoneGroup = new THREE.Group();
    
    // Phone body (larger for visibility)
    const phoneGeometry = new THREE.BoxGeometry(0.04, 0.08, 0.01);
    const phoneMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a1a1a,
      emissive: 0x0066ff,
      emissiveIntensity: 0.5,
    });
    const phone = new THREE.Mesh(phoneGeometry, phoneMaterial);
    phoneGroup.add(phone);
    
    // Phone screen
    const screenGeometry = new THREE.BoxGeometry(0.036, 0.07, 0.002);
    const screenMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = 0.006;
    phoneGroup.add(screen);
    
    // Location marker glow (at the exact center)
    const markerGeometry = new THREE.SphereGeometry(0.06, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.4,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(0, 0, 0); // Ensure it's at the exact center
    phoneGroup.add(marker);
    markerRef.current = marker;
    
    // Position phone on Europe (lat: 50°N, lon: 10°E)
    const latDeg = 50;
    const lonDeg = 10;
    const radius = 1.02;

    // Convert to radians
    const lat = latDeg * (Math.PI / 180);
    const lon = lonDeg * (Math.PI / 180);

    // Standard spherical to Cartesian (lon 0 at +X axis)
    const phoneX = radius * Math.cos(lat) * Math.cos(lon);
    const phoneY = radius * Math.sin(lat);
    const phoneZ = -radius * Math.cos(lat) * Math.sin(lon);

    // Create anchor at this location
    const anchor = new THREE.Object3D();
    anchor.position.set(phoneX, phoneY, phoneZ);
    earth.add(anchor);

    // Point outward from Earth center
    anchor.lookAt(phoneX * 2, phoneY * 2, phoneZ * 2);

    // Attach everything to anchor
    phoneGroup.position.set(0, 0, 0);
    anchor.add(phoneGroup);
    phoneRef.current = phoneGroup;

    // Create LOS point at same anchor location
    const losPoint = new THREE.Object3D();
    losPoint.position.set(0, 0, 0);
    anchor.add(losPoint);
    const losPointRef = { current: losPoint };
    
    // Store anchor reference for repositioning
    const anchorRef = { current: anchor };

    // Debug: Check alignment
    const vPhone = new THREE.Vector3();
    const vLos = new THREE.Vector3();
    phoneGroup.getWorldPosition(vPhone);
    losPoint.getWorldPosition(vLos);
    console.log("phone world:", vPhone);
    console.log("LOS world:", vLos);
    console.log("distance:", vPhone.distanceTo(vLos));

    // Create satellites
    const createSatellites = (count, altitude = 'LEO', customBase = null) => {
      // Remove existing satellites
      satellitesRef.current.forEach(sat => {
        scene.remove(sat.mesh);
        scene.remove(sat.orbit);
        if (sat.trail) scene.remove(sat.trail);
      });
      satellitesRef.current = [];

      const colors = [0x00ff88, 0xff6b6b, 0x4169e1, 0xffd700, 0xff69b4, 0x00ffff];

      // Define orbit radius based on altitude type
      const altitudeConfig = {
        'VLEO': { base: customBase || 350, variance: 50 },
        'LEO': { base: customBase || 600, variance: 100 },
        'MEO': { base: customBase || 8000, variance: 500 }
      };
      const config = altitudeConfig[altitude];
      
      // Dynamic sizing based on satellite count
      const sizeMultiplier = (count >= 1024) ? 0.5 : 1;
      const satSize = 0.02 * sizeMultiplier;
      const glowSize = 0.035 * sizeMultiplier;
      const orbitOpacity = (count >= 1024) ? 0.02 : 0.08;

      for (let i = 0; i < count; i++) {
        // Satellite mesh
        const satGeometry = new THREE.OctahedronGeometry(satSize, 0);
        const satMaterial = new THREE.MeshBasicMaterial({
          color: colors[i % colors.length],
        });
        const satellite = new THREE.Mesh(satGeometry, satMaterial);

        // Glow
        const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: colors[i % colors.length],
          transparent: true,
          opacity: 0.3,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        satellite.add(glow);
        
        // Orbital parameters - calculate radius based on altitude
        const altitudeKm = config.base + (Math.random() - 0.5) * config.variance;
        const orbitRadius = 1 + (altitudeKm / 6371); // Earth radius = 6371 km
        const inclination = (Math.random() - 0.5) * Math.PI * 0.8;
        const startAngle = Math.random() * Math.PI * 2;
        const orbitSpeed = 0.3 + Math.random() * 0.3;
        
        // Orbit visualization
        const orbitGeometry = new THREE.BufferGeometry();
        const orbitPoints = [];
        for (let j = 0; j <= 128; j++) {
          const angle = (j / 128) * Math.PI * 2;
          const x = Math.cos(angle) * orbitRadius;
          const y = Math.sin(angle) * orbitRadius * Math.sin(inclination);
          const z = Math.sin(angle) * orbitRadius * Math.cos(inclination);
          orbitPoints.push(x, y, z);
        }
        orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitPoints, 3));
        const orbitMaterial = new THREE.LineBasicMaterial({
          color: colors[i % colors.length],
          transparent: true,
          opacity: orbitOpacity,
          depthWrite: false,
        });
        const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
        scene.add(orbit);
        
        // Trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(90); // 30 points * 3
        trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPositions, 3));
        const trailMaterial = new THREE.LineBasicMaterial({
          color: colors[i % colors.length],
          transparent: true,
          opacity: 0.5,
        });
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
        
        scene.add(satellite);
        
        satellitesRef.current.push({
          mesh: satellite,
          orbit: orbit,
          trail: trail,
          trailPositions: [],
          orbitRadius,
          inclination,
          angle: startAngle,
          speed: orbitSpeed,
          color: colors[i % colors.length],
          name: `SAT-${String(i + 1).padStart(3, '0')}`,
          altitude: Math.round(altitudeKm), // km
        });
      }
    };

    createSatellites(satelliteCount, orbitAltitude);

    // Create connection lines for satellite communications
    const createConnectionLines = (count) => {
      connectionLinesRef.current.forEach(line => {
        scene.remove(line.main);
        if (line.thick) scene.remove(line.thick);
      });
      connectionLinesRef.current = [];
      
      for (let i = 0; i < count; i++) {
        // Main line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0,
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
        
        // Thick red line (for closest satellite)
        const thickTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 1, 8),
          new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0,
          })
        );
        scene.add(thickTube);
        
        connectionLinesRef.current.push({ main: line, thick: thickTube });
      }
    };
    
    createConnectionLines(satelliteCount);
    containerRef.current.createConnectionLines = createConnectionLines;

    // Mouse controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationVelocity = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        rotationVelocity.x = deltaY * 0.002;
        rotationVelocity.y = deltaX * 0.002;
        
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const onWheel = (e) => {
      camera.position.z = Math.max(2, Math.min(8, camera.position.z + e.deltaY * 0.005));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel);
    
    // Double-click to reposition UE
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const onDoubleClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(earthRef.current);
      
      if (intersects.length > 0) {
        // Get intersection point in world space
        const worldPoint = intersects[0].point.clone();
        
        // Convert to Earth's local space
        earth.worldToLocal(worldPoint);
        
        // Remove old anchor
        earth.remove(anchorRef.current);
        
        // Create new anchor at clicked position in Earth's local space
        const newAnchor = new THREE.Object3D();
        newAnchor.position.copy(worldPoint).normalize().multiplyScalar(1.02);
        earth.add(newAnchor);
        
        // Point outward from Earth center
        const outward = worldPoint.clone().normalize().multiplyScalar(2);
        newAnchor.lookAt(outward);
        
        // Move phone and LOS point to new anchor
        phoneGroup.position.set(0, 0, 0);
        losPoint.position.set(0, 0, 0);
        newAnchor.add(phoneGroup);
        newAnchor.add(losPoint);
        
        // Update reference
        anchorRef.current = newAnchor;
      }
    };
    
    renderer.domElement.addEventListener('dblclick', onDoubleClick);

    // Touch controls
    renderer.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });
    renderer.domElement.addEventListener('touchend', () => { isDragging = false; });
    renderer.domElement.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        rotationVelocity.x = deltaY * 0.002;
        rotationVelocity.y = deltaX * 0.002;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });

    // Animation
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();
      
      // Rotate Earth slowly
      if (earthRef.current && isEarthRotatingRef.current) {
        earthRef.current.rotation.y += 0.0001;
      }
      
      // Apply rotation with damping
      if (!isDragging) {
        rotationVelocity.x *= 0.95;
        rotationVelocity.y *= 0.95;
      }
      
      earthGroup.rotation.x += rotationVelocity.x;
      earthGroup.rotation.y += rotationVelocity.y;
      
      // Slow auto-rotation
      if (!isDragging && Math.abs(rotationVelocity.y) < 0.001 && isEarthRotatingRef.current) {
        earthGroup.rotation.y += 0.001;
      }
      
      // Update satellites
      const currentSpeed = speedRef.current;

      // Get LOS point world position
      const losWorldPos = new THREE.Vector3();
      losPointRef.current.getWorldPosition(losWorldPos);

      // Find closest visible satellite
      let closestSatIndex = -1;
      let minDistance = Infinity;

      satellitesRef.current.forEach((sat, index) => {
        const satPos = new THREE.Vector3(
          Math.cos(sat.angle) * sat.orbitRadius,
          Math.sin(sat.angle) * sat.orbitRadius * Math.sin(sat.inclination),
          Math.sin(sat.angle) * sat.orbitRadius * Math.cos(sat.inclination)
        );
        const toSat = satPos.clone().sub(losWorldPos).normalize();
        const fromEarth = losWorldPos.clone().normalize();
        const isVisible = toSat.dot(fromEarth) > 0;

        if (isVisible) {
          const distance = losWorldPos.distanceTo(satPos);
          if (distance < minDistance) {
            minDistance = distance;
            closestSatIndex = index;
          }
        }
      });

      satellitesRef.current.forEach((sat, index) => {
        if (isPlayingRef.current) {
          sat.angle += sat.speed * delta * currentSpeed;
        }
        
        const x = Math.cos(sat.angle) * sat.orbitRadius;
        const y = Math.sin(sat.angle) * sat.orbitRadius * Math.sin(sat.inclination);
        const z = Math.sin(sat.angle) * sat.orbitRadius * Math.cos(sat.inclination);
        
        sat.mesh.position.set(x, y, z);
        sat.mesh.rotation.x = elapsed * 2;
        sat.mesh.rotation.y = elapsed * 3;
        
        // Update trail
        sat.trailPositions.unshift({ x, y, z });
        if (sat.trailPositions.length > 30) {
          sat.trailPositions.pop();
        }
        
        const positions = sat.trail.geometry.attributes.position.array;
        for (let i = 0; i < sat.trailPositions.length; i++) {
          positions[i * 3] = sat.trailPositions[i].x;
          positions[i * 3 + 1] = sat.trailPositions[i].y;
          positions[i * 3 + 2] = sat.trailPositions[i].z;
        }
        sat.trail.geometry.attributes.position.needsUpdate = true;
        sat.trail.geometry.setDrawRange(0, sat.trailPositions.length);

        // Check line of sight from LOS point to satellite
        const satPos = new THREE.Vector3(x, y, z);
        const toSat = satPos.clone().sub(losWorldPos).normalize();
        const fromEarth = losWorldPos.clone().normalize();
        
        // Check if satellite is above horizon (dot product > 0)
        const isVisible = toSat.dot(fromEarth) > 0;
        
        // Update connection line
        if (connectionLinesRef.current[index]) {
          const lineObj = connectionLinesRef.current[index];
          const points = [losWorldPos.clone(), satPos.clone()];
          
          // Update main line
          lineObj.main.geometry.setFromPoints(points);
          lineObj.main.material.opacity = isVisible && index !== closestSatIndex ? 0.4 : 0;
          lineObj.main.material.color.setHex(0x00ffff);
          
          // Update thick red line (only for closest satellite)
          if (index === closestSatIndex && isVisible) {
            const direction = satPos.clone().sub(losWorldPos);
            const length = direction.length();
            const midpoint = losWorldPos.clone().add(satPos).multiplyScalar(0.5);
            
            lineObj.thick.position.copy(midpoint);
            lineObj.thick.scale.y = length;
            lineObj.thick.lookAt(satPos);
            lineObj.thick.rotateX(Math.PI / 2);
            lineObj.thick.material.opacity = 0.8;
          } else {
            lineObj.thick.material.opacity = 0;
          }
        }
        
        // Update satellite glow for closest satellite
        const satGlow = sat.mesh.children[0];
        if (index === closestSatIndex && isVisible) {
          satGlow.scale.set(1.5, 1.5, 1.5);
          satGlow.material.opacity = 0.6;
        } else {
          satGlow.scale.set(1, 1, 1);
          satGlow.material.opacity = 0.3;
        }
        });

        // MCS table based on C/N (SNR)
        const mcsTable = [
          { modulation: 'QPSK', codeRate: 0.08, snr: -4.25, bitsPerSymbol: 2 },
          { modulation: 'QPSK', codeRate: 0.12, snr: -2.96, bitsPerSymbol: 2 },
          { modulation: 'QPSK', codeRate: 0.19, snr: -1.46, bitsPerSymbol: 2 },
          { modulation: 'QPSK', codeRate: 0.3, snr: 0.49, bitsPerSymbol: 2 },
          { modulation: 'QPSK', codeRate: 0.44, snr: 2.46, bitsPerSymbol: 2 },
          { modulation: 'QPSK', codeRate: 0.59, snr: 4.38, bitsPerSymbol: 2 },
          { modulation: '16QAM', codeRate: 0.37, snr: 4.91, bitsPerSymbol: 4 },
          { modulation: '16QAM', codeRate: 0.48, snr: 7.2, bitsPerSymbol: 4 },
          { modulation: '16QAM', codeRate: 0.6, snr: 8.71, bitsPerSymbol: 4 },
          { modulation: '64QAM', codeRate: 0.46, snr: 11.01, bitsPerSymbol: 6 },
          { modulation: '64QAM', codeRate: 0.55, snr: 12.95, bitsPerSymbol: 6 },
          { modulation: '64QAM', codeRate: 0.65, snr: 14.85, bitsPerSymbol: 6 },
          { modulation: '64QAM', codeRate: 0.75, snr: 17.07, bitsPerSymbol: 6 },
          { modulation: '64QAM', codeRate: 0.85, snr: 19.88, bitsPerSymbol: 6 },
          { modulation: '64QAM', codeRate: 0.93, snr: 24.46, bitsPerSymbol: 6 },
          { modulation: '256QAM', codeRate: 0.66, snr: 24.5, bitsPerSymbol: 8 },
          { modulation: '256QAM', codeRate: 0.69, snr: 25, bitsPerSymbol: 8 },
          { modulation: '256QAM', codeRate: 0.73, snr: 25.5, bitsPerSymbol: 8 },
          { modulation: '256QAM', codeRate: 0.77, snr: 26.5, bitsPerSymbol: 8 },
          { modulation: '256QAM', codeRate: 0.82, snr: 27, bitsPerSymbol: 8 },
          { modulation: '256QAM', codeRate: 0.86, snr: 29.5, bitsPerSymbol: 8 },
          { modulation: '256QAM', codeRate: 0.89, snr: 30.5, bitsPerSymbol: 8 },
          { modulation: '256QAM', codeRate: 0.92, snr: 36, bitsPerSymbol: 8 }
        ];

        // Calculate UT statistics based on best satellite position
        const visibleSatellites = satellitesRef.current.filter((sat, index) => {
        const satPos = new THREE.Vector3(
          Math.cos(sat.angle) * sat.orbitRadius,
          Math.sin(sat.angle) * sat.orbitRadius * Math.sin(sat.inclination),
          Math.sin(sat.angle) * sat.orbitRadius * Math.cos(sat.inclination)
        );
        const losWorldPos = new THREE.Vector3();
        losPointRef.current.getWorldPosition(losWorldPos);
        const toSat = satPos.clone().sub(losWorldPos).normalize();
        const fromEarth = losWorldPos.clone().normalize();
        return toSat.dot(fromEarth) > 0;
        });

        if (visibleSatellites.length > 0) {
        // Find closest visible satellite
        const losWorldPos = new THREE.Vector3();
        losPointRef.current.getWorldPosition(losWorldPos);

        let minDistance = Infinity;
        visibleSatellites.forEach(sat => {
          const satPos = new THREE.Vector3(
            Math.cos(sat.angle) * sat.orbitRadius,
            Math.sin(sat.angle) * sat.orbitRadius * Math.sin(sat.inclination),
            Math.sin(sat.angle) * sat.orbitRadius * Math.cos(sat.inclination)
          );
          const distance = losWorldPos.distanceTo(satPos);
          if (distance < minDistance) minDistance = distance;
        });

        // Update satellite distance and calculate C/N (throttled)
        const now = Date.now();
        if (now - lastDistanceUpdateRef.current >= 100) {
          lastDistanceUpdateRef.current = now;

          const distanceKm = minDistance * 6371;
          distanceHistoryRef.current.push({ value: distanceKm, timestamp: now });

          // Remove measurements older than 2 seconds
          distanceHistoryRef.current = distanceHistoryRef.current.filter(
            item => now - item.timestamp <= 2000
          );

          // Calculate average distance
          if (distanceHistoryRef.current.length > 0) {
            const avgDistance = distanceHistoryRef.current.reduce((sum, item) => sum + item.value, 0) / distanceHistoryRef.current.length;
            setSatelliteDistance(avgDistance);

            // Calculate scan loss based on antenna type
            let currentScanLoss = 0;
            const closestSat = satellitesRef.current[closestSatIndex];
            if (closestSat) {
              const satPos = new THREE.Vector3(
                Math.cos(closestSat.angle) * closestSat.orbitRadius,
                Math.sin(closestSat.angle) * closestSat.orbitRadius * Math.sin(closestSat.inclination),
                Math.sin(closestSat.angle) * closestSat.orbitRadius * Math.cos(closestSat.inclination)
              );

              // Calculate APR angle (angle between UE and satellite)
              const toSat = satPos.clone().sub(losWorldPos).normalize();
              const fromEarth = losWorldPos.clone().normalize();
              const calculatedAprAngle = Math.acos(Math.max(-1, Math.min(1, toSat.dot(fromEarth)))) * (180 / Math.PI);
              setAprAngle(calculatedAprAngle);

              // Calculate scan loss
              if (antennaTypeRef.current === 'dish') {
                currentScanLoss = 0;
              } else {
                const cosAPR = Math.cos(calculatedAprAngle * Math.PI / 180);
                currentScanLoss = cosAPR > 0 ? -20 * Math.log10(cosAPR) : 0;
              }
              setScanLoss(currentScanLoss);
              scanLossRef.current = currentScanLoss;
            }

            // Calculate C/N ratio using refs for current values
            const fspl = 92.45 + 20 * Math.log10(channelFrequencyRef.current) + 20 * Math.log10(avgDistance);
            const totalPower = 10 * Math.log10(txPowerWRef.current * 1000) + satAntennaGainRef.current + terminalAntennaGainRef.current - otherLossesRef.current - currentScanLoss - fspl;
            const noisePower = -174 + 10 * Math.log10(channelBWRef.current * 1000000) + noiseFigureRef.current;
            const cnRatio = totalPower - noisePower;

            // Find the best MCS based on C/N ratio
            let selectedMcs = mcsTable[0]; // Default to lowest MCS
            let nextMcs = null;
            for (let i = mcsTable.length - 1; i >= 0; i--) {
              if (cnRatio >= mcsTable[i].snr) {
                selectedMcs = mcsTable[i];
                if (i < mcsTable.length - 1) {
                  nextMcs = mcsTable[i + 1];
                }
                break;
              }
            }

            // Apply smoothing: interpolate code rate if we have spare SNR
            let effectiveCodeRate = selectedMcs.codeRate;
            if (nextMcs && cnRatio > selectedMcs.snr) {
              const snrMargin = nextMcs.snr - selectedMcs.snr;
              const spareSNR = cnRatio - selectedMcs.snr;
              const interpolationFactor = Math.min(spareSNR / snrMargin, 1);
              effectiveCodeRate = selectedMcs.codeRate + (nextMcs.codeRate - selectedMcs.codeRate) * interpolationFactor;
            }

            // Calculate raw throughput: BW (MHz) × code_rate × bits_per_symbol
            const rawThroughput = channelBWRef.current * effectiveCodeRate * selectedMcs.bitsPerSymbol;
            
            // Normalize to max 1Gbps (highest MCS gives: 400 * 0.92 * 8 = 2944 Mbps)
            const maxRawThroughput = 400 * 0.92 * 8; // 2944 Mbps
            const throughput = (rawThroughput / maxRawThroughput) * 1000; // Scale to 1000 Mbps max

            setCurrentConstellation(selectedMcs.modulation);
            setCurrentCodeRate(effectiveCodeRate);

            if (throughput >= 1000) {
              setCurrentThroughput(`${(throughput / 1000).toFixed(2)}Gbps`);
            } else {
              setCurrentThroughput(`${Math.round(throughput)}Mbps`);
            }
          }
        }

        // Calculate satellite velocity and Doppler shift
        const closestSat = satellitesRef.current[closestSatIndex];
        if (closestSat) {
          // Calculate orbital velocity in km/s (v = sqrt(GM/r))
          // For LEO at altitude ~500km: v ≈ 7.6 km/s
          const earthRadius = 6371; // km
          const altitude = closestSat.altitude;
          const orbitalRadius = earthRadius + altitude;
          const orbitalVelocity = Math.sqrt(398600.4418 / orbitalRadius); // km/s

          // Calculate radial velocity (velocity component along line of sight)
          const satPos = new THREE.Vector3(
            Math.cos(closestSat.angle) * closestSat.orbitRadius,
            Math.sin(closestSat.angle) * closestSat.orbitRadius * Math.sin(closestSat.inclination),
            Math.sin(closestSat.angle) * closestSat.orbitRadius * Math.cos(closestSat.inclination)
          );
          
          // Velocity direction (tangent to orbit)
          const velocityDir = new THREE.Vector3(
            -Math.sin(closestSat.angle) * closestSat.orbitRadius,
            Math.cos(closestSat.angle) * closestSat.orbitRadius * Math.sin(closestSat.inclination),
            Math.cos(closestSat.angle) * closestSat.orbitRadius * Math.cos(closestSat.inclination)
          ).normalize();

          // Line of sight direction
          const losDir = satPos.clone().sub(losWorldPos).normalize();
          
          // Radial velocity component
          const radialVelocity = orbitalVelocity * velocityDir.dot(losDir);
          
          setSatelliteVelocity(orbitalVelocity);
          
          // Calculate Doppler shift for KA band (26 GHz)
          const kaFrequency = 26e9; // Hz
          const speedOfLight = 299792.458; // km/s
          const dopplerShift = (radialVelocity / speedOfLight) * kaFrequency;
          
          // Throttle updates to once every 100ms
          const now = Date.now();
          if (now - lastDopplerUpdateRef.current >= 100) {
            lastDopplerUpdateRef.current = now;
            
            // Add to history with timestamp
            dopplerHistoryRef.current.push({ value: dopplerShift / 1e3, timestamp: now });
            
            // Remove measurements older than 2 seconds
            dopplerHistoryRef.current = dopplerHistoryRef.current.filter(
              item => now - item.timestamp <= 2000
            );
            
            // Calculate average
            if (dopplerHistoryRef.current.length > 0) {
              const averageDoppler = dopplerHistoryRef.current.reduce((sum, item) => sum + item.value, 0) / dopplerHistoryRef.current.length;
              setMeasuredDoppler(averageDoppler);
            }
          }
        }
        } else {
        setCurrentThroughput('0Mbps');
        setCurrentConstellation('N/A');
        setCurrentCodeRate('N/A');
        setSatelliteVelocity(0);
        setMeasuredDoppler(0);
        }

      renderer.render(scene, camera);
    };
    
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Store createSatellites function for later use
    containerRef.current.createSatellites = createSatellites;

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update base altitude defaults when orbit type changes
  useEffect(() => {
    const defaults = {
      'VLEO': 250,
      'LEO': 600,
      'MEO': 4000
    };
    const newBase = defaults[orbitAltitude];
    setBaseAltitude(newBase);
    baseAltitudeRef.current = newBase;
  }, [orbitAltitude]);

  // Update satellites when count, altitude, or base changes
  useEffect(() => {
    if (containerRef.current?.createSatellites) {
      containerRef.current.createSatellites(satelliteCount, orbitAltitude, baseAltitudeRef.current);
      containerRef.current.createConnectionLines(satelliteCount);
    }
  }, [satelliteCount, orbitAltitude, baseAltitude]);

  const resetView = () => {
    if (sceneRef.current && phoneRef.current) {
      const earthGroup = sceneRef.current.children.find(child => child.type === 'Group');
      if (earthGroup) {
        const anchor = phoneRef.current.parent;
        const ueLocalPos = anchor.position.clone();

        // Calculate Y rotation to align UE with camera (+Z)
        const targetY = -Math.atan2(ueLocalPos.x, ueLocalPos.z);

        earthGroup.rotation.set(0, targetY, 0);
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d1020] to-[#0a0a0f] overflow-hidden">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 md:p-8 flex justify-between items-start pointer-events-none">
        <div>
          <h1 className="text-2xl md:text-3xl font-light text-white tracking-wide">
            Ceva Satellite Communication - PentaG-NTN Simulation
          </h1>
          <p className="text-sm text-white/40 mt-1 font-light">
            Low Earth Orbit Visualization
          </p>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowInfo(!showInfo)}
          className="pointer-events-auto text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <Info className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Info Panel */}
      {showInfo && (
        <div className="absolute top-20 right-6 md:right-8 w-72 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-white/80 text-sm animate-in fade-in slide-in-from-right-4 duration-300 z-50">
          <h3 className="font-medium text-white mb-3 flex items-center gap-2">
            <Satellite className="h-4 w-4" />
            About LEO Satellites
          </h3>
          <p className="leading-relaxed text-white/60">
            Low Earth Orbit (LEO) satellites orbit between 160-2,000 km above Earth's surface. 
            They complete an orbit in approximately 90 minutes and are used for communications, 
            Earth observation, and scientific research.
          </p>
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <div className="flex justify-between">
              <span className="text-white/40">Orbit Period</span>
              <span>~90 minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Speed</span>
              <span>~7.8 km/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Altitude</span>
              <span>160-2,000 km</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Channel Parameters Panel */}
      <div className="absolute left-6 md:left-8 top-24 hidden md:block">
        <div className={`bg-black/30 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden transition-all duration-300 ${isChannelParamsOpen ? 'w-64 p-3 space-y-2' : 'w-auto'}`}>
          <div className={`flex items-center justify-between ${isChannelParamsOpen ? 'mb-2' : 'p-2'}`}>
            {isChannelParamsOpen && <h4 className="text-xs uppercase tracking-wider text-white/40">Satellite Channel Settings</h4>}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsChannelParamsOpen(!isChannelParamsOpen)}
              className={`text-white/60 hover:text-white hover:bg-white/10 ${isChannelParamsOpen ? 'h-6 w-6' : 'h-10 w-10'}`}
            >
              {isChannelParamsOpen ? <ChevronDown className="h-3 w-3" /> : <Settings className="h-5 w-5" />}
            </Button>
          </div>

            {isChannelParamsOpen && (
            <>
            {/* Tx Section */}
            <div className="space-y-1.5">
            <div className="text-[10px] text-white/60 font-semibold">Gateway:</div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Tx Power [W]:</label>
              <input
                type="number"
                value={txPowerW}
                onChange={(e) => {
                  const val = e.target.valueAsNumber || 0;
                  setTxPowerW(val);
                  txPowerWRef.current = val;
                }}
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">W</span>
            </div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Tx Power [dBm]:</label>
              <input
                type="text"
                value={(10 * Math.log10(txPowerW * 1000)).toFixed(2)}
                readOnly
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/60 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">dBm</span>
            </div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Sat. Ant. Gain:</label>
              <input
                type="number"
                value={satAntennaGain}
                onChange={(e) => {
                  const val = e.target.valueAsNumber || 0;
                  setSatAntennaGain(val);
                  satAntennaGainRef.current = val;
                }}
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">dBi</span>
            </div>
            </div>

            {/* Rx Section */}
            <div className="space-y-1.5">
            <div className="text-[10px] text-white/60 font-semibold">User Terminal:</div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Term. Ant. Gain:</label>
              <input
                type="number"
                value={terminalAntennaGain}
                onChange={(e) => {
                  const val = e.target.valueAsNumber || 0;
                  setTerminalAntennaGain(val);
                  terminalAntennaGainRef.current = val;
                }}
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">dBi</span>
            </div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Noise Figure:</label>
              <input
                type="number"
                value={noiseFigure}
                onChange={(e) => {
                  const val = e.target.valueAsNumber || 0;
                  setNoiseFigure(val);
                  noiseFigureRef.current = val;
                }}
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">dB</span>
            </div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Other Losses:</label>
              <input
                type="number"
                value={otherLosses}
                onChange={(e) => {
                  const val = e.target.valueAsNumber || 0;
                  setOtherLosses(val);
                  otherLossesRef.current = val;
                }}
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">dB</span>
            </div>
            </div>

            {/* Channel Section */}
            <div className="space-y-1.5">
            <div className="text-[10px] text-white/60 font-semibold">Channel:</div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Frequency:</label>
              <input
                type="number"
                value={channelFrequency}
                onChange={(e) => {
                  const val = e.target.valueAsNumber || 0;
                  setChannelFrequency(val);
                  channelFrequencyRef.current = val;
                }}
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">GHz</span>
            </div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Channel BW:</label>
              <input
                type="number"
                value={channelBW}
                onChange={(e) => {
                  const val = e.target.valueAsNumber || 0;
                  setChannelBW(val);
                  channelBWRef.current = val;
                }}
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">MHz</span>
            </div>
            </div>

            {/* Antenna Type */}
            <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-white/60 font-semibold">Antenna Type:</div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAntennaType('dish');
                    antennaTypeRef.current = 'dish';
                  }}
                  className={`text-[10px] px-2 py-0.5 h-5 transition-all ${
                    antennaType === 'dish' 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/40 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Dish
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAntennaType('phased_array');
                    antennaTypeRef.current = 'phased_array';
                  }}
                  className={`text-[10px] px-2 py-0.5 h-5 transition-all ${
                    antennaType === 'phased_array' 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/40 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Phased Array
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Aperture Angle:</label>
              <input
                type="text"
                value={aprAngle.toFixed(2)}
                readOnly
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/60 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">°</span>
            </div>
            <div className="flex items-center gap-1.5 pl-3">
              <label className="text-[10px] text-white/50 w-28">Scan Loss:</label>
              <input
                type="text"
                value={scanLoss.toFixed(2)}
                readOnly
                className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/60 text-right"
              />
              <span className="text-[10px] text-white/50 w-8">dB</span>
            </div>
            </div>

            {/* FSPL */}
            <div className="pt-1.5 border-t border-white/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50">Satellite Distance:</span>
              <span className="text-[10px] text-white/90 font-medium">
                {satelliteDistance > 0 ? satelliteDistance.toFixed(2) : '—'} km
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50">FSPL:</span>
              <span className="text-[10px] text-cyan-400 font-medium">
                {satelliteDistance > 0 ? 
                  (92.45 + 20 * Math.log10(channelFrequencyRef.current) + 20 * Math.log10(satelliteDistance)).toFixed(2) : 
                  '—'
                } dB
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50">Total Power:</span>
              <span className="text-[10px] text-green-400 font-medium">
                {satelliteDistance > 0 ? 
                  (10 * Math.log10(txPowerWRef.current * 1000) + satAntennaGainRef.current + terminalAntennaGainRef.current - otherLossesRef.current - scanLossRef.current - (92.45 + 20 * Math.log10(channelFrequencyRef.current) + 20 * Math.log10(satelliteDistance))).toFixed(2) : 
                  '—'
                } dBm
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50">Noise Power:</span>
              <span className="text-[10px] text-orange-400 font-medium">
                {(-174 + 10 * Math.log10(channelBWRef.current * 1000000) + noiseFigureRef.current).toFixed(2)} dBm
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50">C/N:</span>
              <span className="text-[10px] text-purple-400 font-medium">
                {satelliteDistance > 0 ? 
                  ((10 * Math.log10(txPowerWRef.current * 1000) + satAntennaGainRef.current + terminalAntennaGainRef.current - otherLossesRef.current - scanLossRef.current - (92.45 + 20 * Math.log10(channelFrequencyRef.current) + 20 * Math.log10(satelliteDistance))) - (-174 + 10 * Math.log10(channelBWRef.current * 1000000) + noiseFigureRef.current)).toFixed(2) : 
                  '—'
                } dB
              </span>
            </div>
            </div>
            </>
            )}
            </div>
            </div>

            {/* Satellite List */}
      <div className="absolute right-64 md:right-72 bottom-6 hidden md:block">
        <div className={`bg-black/30 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden transition-all duration-300 ${isSatelliteListOpen ? 'w-44 h-[180px]' : 'w-auto h-auto'}`}>
          <div className={`flex items-center justify-between ${isSatelliteListOpen ? 'p-3 pb-0' : 'p-2'}`}>
            {isSatelliteListOpen && <h4 className="text-xs uppercase tracking-wider text-white/40">Active Satellites</h4>}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSatelliteListOpen(!isSatelliteListOpen)}
              className="text-white/60 hover:text-white hover:bg-white/10 h-6 w-6"
            >
              {isSatelliteListOpen ? <ChevronDown className="h-3 w-3" /> : <Satellite className="h-3 w-3" />}
            </Button>
          </div>
          {isSatelliteListOpen && (
            <div className="p-3 pt-2 max-h-[130px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/40 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div className="space-y-2">
                {satellitesRef.current.map((sat, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-3 text-sm text-white/70 hover:text-white transition-colors cursor-pointer group"
                  >
                    <div 
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: `#${sat.color.toString(16).padStart(6, '0')}` }}
                    />
                    <span className="font-mono text-xs">{sat.name}</span>
                    <span className="text-white/30 text-xs ml-auto group-hover:text-white/60">
                      {sat.altitude} km
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Constellation Parameters */}
      <div className="absolute right-6 md:right-8 top-24 hidden md:block w-56">
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-3">
          <h4 className="text-xs uppercase tracking-wider text-white/40 mb-3">Constellation Parameters</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Frequency:</span>
              <span className="text-white/90 font-medium">
                {channelFrequency < 2 ? 'L' : 
                 channelFrequency < 4 ? 'S' : 
                 channelFrequency < 8 ? 'C' : 
                 channelFrequency < 12 ? 'X' : 
                 channelFrequency < 18 ? 'Ku' : 
                 channelFrequency < 27 ? 'K' : 
                 channelFrequency < 40 ? 'Ka' : 'V'} Band
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Channel BW:</span>
              <span className="text-white/90 font-medium">{channelBW}MHz</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Numerology:</span>
              <span className="text-white/90 font-medium">2, 120KHz SCS</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Constellation:</span>
              <span className="text-white/90 font-medium">256QAM</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Peak Throughput:</span>
              <span className="text-white/90 font-medium">1Gbps</span>
            </div>
          </div>
        </div>
      </div>

      {/* UT Statistics */}
      <div className="absolute right-6 md:right-8 top-72 hidden md:block w-56">
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-3">
          <h4 className="text-xs uppercase tracking-wider text-white/40 mb-3">UT Statistics</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Max Throughput:</span>
              <span className="text-white/90 font-medium">1Gbps</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Current Throughput:</span>
              <span className="text-green-400 font-medium">{currentThroughput}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Constellation:</span>
              <span className="text-blue-400 font-medium">{currentConstellation}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Code Rate:</span>
              <span className="text-purple-400 font-medium">{typeof currentCodeRate === 'number' ? currentCodeRate.toFixed(2) : currentCodeRate}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Satellite Velocity:</span>
              <span className="text-cyan-400 font-medium">{satelliteVelocity.toFixed(2)} km/s</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50">Measured Doppler:</span>
              <span className="text-yellow-400 font-medium">{measuredDoppler >= 0 ? '+' : ''}{measuredDoppler.toFixed(1)} kHz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Throughput Gauge */}
      <div className="absolute right-6 md:right-8 bottom-52 hidden md:block w-56">
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <h4 className="text-xs uppercase tracking-wider text-white/40 mb-3 text-center">Current Throughput</h4>
          <div className="flex flex-col items-center">
            {/* Speedometer-style Gauge */}
            <div className="relative w-48 h-32">
              <svg viewBox="0 0 240 140" className="w-full h-full">
                {/* Outer rim */}
                <path
                  d="M 30 120 A 90 90 0 0 1 210 120"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                />

                {/* Major tick marks and labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((value, i) => {
                  const angle = Math.PI * (1 - value);
                  const x1 = 120 + 85 * Math.cos(angle);
                  const y1 = 120 - 85 * Math.sin(angle);
                  const x2 = 120 + 70 * Math.cos(angle);
                  const y2 = 120 - 70 * Math.sin(angle);
                  const labelX = 120 + 108 * Math.cos(angle);
                  const labelY = 120 - 108 * Math.sin(angle) + 5;
                  const label = value === 1 ? '1G' : value === 0 ? '0' : `${value * 1000}M`;

                  return (
                    <g key={i}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                      <text x={labelX} y={labelY} fill="rgba(255,255,255,0.7)" fontSize="11" textAnchor="middle" fontWeight="bold">
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Minor tick marks */}
                {Array.from({ length: 21 }, (_, i) => i / 20).map((value, i) => {
                  if (value % 0.25 === 0) return null;
                  const angle = Math.PI * (1 - value);
                  const x1 = 120 + 85 * Math.cos(angle);
                  const y1 = 120 - 85 * Math.sin(angle);
                  const x2 = 120 + 77 * Math.cos(angle);
                  const y2 = 120 - 77 * Math.sin(angle);

                  return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                  );
                })}

                {/* Colored arc */}
                <path
                  d="M 30 120 A 90 90 0 0 1 210 120"
                  fill="none"
                  stroke="url(#gaugeGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.4"
                />

                {/* Needle */}
                <line
                  x1="120"
                  y1="120"
                  x2={120 + 65 * Math.cos(Math.PI * (1 - (currentThroughput === '1Gbps' ? 1 : parseInt(currentThroughput) / 1000)))}
                  y2={120 - 65 * Math.sin(Math.PI * (1 - (currentThroughput === '1Gbps' ? 1 : parseInt(currentThroughput) / 1000)))}
                  stroke="#ff8800"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="transition-all duration-300"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(255,136,0,0.8))' }}
                />

                {/* Center hub */}
                <circle cx="120" cy="120" r="8" fill="rgba(20,20,20,0.9)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                <circle cx="120" cy="120" r="4" fill="#ff8800" />

                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            {/* Value display */}
            <div className="text-xl font-bold text-white mt-1">{currentThroughput}</div>
          </div>
        </div>
      </div>

      {/* Doppler Gauge */}
      <div className="absolute right-6 md:right-8 bottom-6 hidden md:block w-56">
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-3">
          <h4 className="text-xs uppercase tracking-wider text-white/40 mb-2 text-center">Measured Doppler</h4>
          <div className="flex flex-col items-center">
            {/* Doppler Gauge */}
            <div className="relative w-48 h-24">
              <svg viewBox="0 0 240 110" className="w-full h-full">
                {/* Outer rim */}
                <path
                  d="M 30 120 A 90 90 0 0 1 210 120"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                />

                {/* Major tick marks and labels */}
                {[-700, -350, 0, 350, 700].map((value, i) => {
                  const normalized = (value + 700) / 1400;
                  const angle = Math.PI * (1 - normalized);
                  const x1 = 120 + 85 * Math.cos(angle);
                  const y1 = 120 - 85 * Math.sin(angle);
                  const x2 = 120 + 70 * Math.cos(angle);
                  const y2 = 120 - 70 * Math.sin(angle);
                  const labelX = 120 + 108 * Math.cos(angle);
                  const labelY = 120 - 108 * Math.sin(angle) + 5;
                  const label = value > 0 ? `+${value}` : value;

                  return (
                    <g key={i}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                      <text x={labelX} y={labelY} fill="rgba(255,255,255,0.7)" fontSize="11" textAnchor="middle" fontWeight="bold">
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Minor tick marks */}
                {Array.from({ length: 21 }, (_, i) => i / 20).map((value, i) => {
                  if ((value * 1400 - 700) % 350 === 0) return null;
                  const angle = Math.PI * (1 - value);
                  const x1 = 120 + 85 * Math.cos(angle);
                  const y1 = 120 - 85 * Math.sin(angle);
                  const x2 = 120 + 77 * Math.cos(angle);
                  const y2 = 120 - 77 * Math.sin(angle);

                  return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                  );
                })}

                {/* Colored arc */}
                <path
                  d="M 30 120 A 90 90 0 0 1 210 120"
                  fill="none"
                  stroke="url(#dopplerGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.4"
                />

                {/* Needle */}
                <line
                  x1="120"
                  y1="120"
                  x2={120 + 65 * Math.cos(Math.PI * (1 - (Math.max(-700, Math.min(700, measuredDoppler)) + 700) / 1400))}
                  y2={120 - 65 * Math.sin(Math.PI * (1 - (Math.max(-700, Math.min(700, measuredDoppler)) + 700) / 1400))}
                  stroke="#00ffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="transition-all duration-300"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,255,0.8))' }}
                />

                {/* Center hub */}
                <circle cx="120" cy="120" r="8" fill="rgba(20,20,20,0.9)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                <circle cx="120" cy="120" r="4" fill="#00ffff" />

                <defs>
                  <linearGradient id="dopplerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            {/* Value display */}
            <div className="text-xl font-bold text-cyan-400 mt-1">{measuredDoppler >= 0 ? '+' : ''}{measuredDoppler.toFixed(1)} kHz</div>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-6 md:bottom-8 left-6 md:left-8 space-y-3">
        <div className="max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 pb-0">
            <h3 className="text-xs text-white/60 font-medium">Simulation Control</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsControlsOpen(!isControlsOpen)}
              className="text-white/60 hover:text-white hover:bg-white/10 h-6 w-6"
            >
              {isControlsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
          </div>

          {isControlsOpen && (
            <div className="p-3 pt-2">
              <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newValue = !isPlaying;
                  setIsPlaying(newValue);
                  isPlayingRef.current = newValue;
                }}
                className="text-white hover:bg-white/10 transition-all h-7 w-7"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <span className="text-[10px] text-white/40">Sats</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newValue = !isEarthRotating;
                  setIsEarthRotating(newValue);
                  isEarthRotatingRef.current = newValue;
                }}
                className="text-white hover:bg-white/10 transition-all h-7 w-7"
              >
                {isEarthRotating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <span className="text-[10px] text-white/40">Earth</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={resetView}
              className="text-white/60 hover:text-white hover:bg-white/10 transition-all h-7 w-7"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>

            <div className="flex items-center gap-2 min-w-[160px]">
              <Zap className="h-3 w-3 text-white/40" />
              <Slider
                value={speed}
                onValueChange={(value) => {
                  setSpeed(value);
                  speedRef.current = value[0];
                }}
                min={0.01}
                max={1}
                step={0.01}
                className="w-24"
              />
              <span className="text-[10px] text-white/40 w-10">{speed[0].toFixed(2)}x</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Satellite className="h-3 w-3 text-white/40" />
              <span className="text-[10px] text-white/60">Satellites</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[6, 12, 24, 48, 128, 256, 1024, 2048].map((count) => (
                <Button
                  key={count}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSatelliteCount(count)}
                  className={`text-[10px] px-2 py-0.5 h-6 transition-all ${
                    satelliteCount === count 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/40 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {count}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Satellite className="h-3 w-3 text-white/40" />
              <span className="text-[10px] text-white/60">Orbit</span>
            </div>
            <div className="flex items-center gap-1.5">
              {['VLEO', 'LEO', 'MEO'].map((altitude) => (
                <Button
                  key={altitude}
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrbitAltitude(altitude)}
                  className={`text-[10px] px-2 py-0.5 h-6 transition-all ${
                    orbitAltitude === altitude 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/40 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {altitude}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Satellite className="h-3 w-3 text-white/40" />
              <span className="text-[10px] text-white/60">Base Alt</span>
            </div>
            <div className="flex items-center gap-2 min-w-[140px]">
              <Slider
                value={[baseAltitude]}
                onValueChange={(value) => {
                  setBaseAltitude(value[0]);
                  baseAltitudeRef.current = value[0];
                }}
                min={orbitAltitude === 'VLEO' ? 100 : orbitAltitude === 'LEO' ? 400 : 1200}
                max={orbitAltitude === 'VLEO' ? 400 : orbitAltitude === 'LEO' ? 1200 : 15000}
                step={50}
                className="w-20"
              />
              <span className="text-[10px] text-white/40 w-12">{baseAltitude} km</span>
            </div>
          </div>
            </div>
            )}
            </div>

            {/* Stats Badge */}
            <div className="flex justify-center">
            <Badge 
            variant="outline" 
            className="bg-black/40 backdrop-blur-xl border-white/10 text-white/60 px-3 py-1.5"
            >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2" />
            {satelliteCount} satellites active
            </Badge>
            </div>
            </div>
      
      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <p className="text-center text-white/30 text-xs">
          Drag to rotate • Scroll to zoom • Double-click to move UE
        </p>
      </div>
      

    </div>
  );
}