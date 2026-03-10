import {
  Camera,
  Geometry,
  Mesh,
  Program,
  Renderer,
  Texture,
  Transform,
  Vec3,
} from "ogl";
import React, { useEffect, useRef } from "react";
import styles from "./SpaceHeroCanvas.module.css";

export const SpaceHeroCanvas = React.memo(
  function SpaceHeroCanvasContent(): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);

    const isVisibleRef = useRef<boolean>(true);
    const frameIdRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);

    const mouseRef = useRef({ x: 0, y: 0 });
    const targetCameraPos = useRef(new Vec3(0, 0, 0));
    const targetParallaxRef = useRef(0);
    const currentParallaxRef = useRef(0);
    const actualScrollRef = useRef(0);
    const targetRotationRef = useRef(0);
    const currentRotationRef = useRef(0);

    useEffect(() => {
      // Find the scroll container exactly once to avoid synchronous layout
      // recalculations (`getComputedStyle`) on every scroll event tick.
      let cachedScrollContainer: Element | null = null;
      let scrollTarget: Window | Element = window;

      if (containerRef.current) {
        let parent = containerRef.current.parentElement;
        while (parent) {
          const hasOverflow =
            window.getComputedStyle(parent).overflowY === "scroll" ||
            window.getComputedStyle(parent).overflowY === "auto";
          if (hasOverflow && parent.scrollHeight > parent.clientHeight) {
            cachedScrollContainer = parent;
            scrollTarget = parent;
            break;
          }
          parent = parent.parentElement;
        }

        if (!cachedScrollContainer) {
          const allElements = document.querySelectorAll(
            '[style*="overflow-y"], [style*="overflowY"], [class*="scrollContainer"]'
          );
          for (const el of allElements) {
            const overflow = window.getComputedStyle(el).overflowY;
            if (
              (overflow === "scroll" || overflow === "auto") &&
              el.scrollHeight > el.clientHeight
            ) {
              cachedScrollContainer = el as Element;
              scrollTarget = el;
              break;
            }
          }
        }
      }

      const handleScroll = () => {
        const vh = window.innerHeight;
        const scrollY = cachedScrollContainer
          ? cachedScrollContainer.scrollTop
          : window.scrollY;

        targetParallaxRef.current = scrollY / vh;
        actualScrollRef.current = scrollY;
      };

      scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll(); // Initial read
      
      return () => scrollTarget.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
      if (!containerRef.current) return;

      let cleanupFunc: (() => void) | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const initWebGL = () => {
        if (!containerRef.current) return;

        // Kick off heavy computation in a Web Worker immediately
        const worker = new Worker(
          new URL("./spaceWorker.ts?v=11", import.meta.url),
          {
            type: "module",
          }
        );
        worker.postMessage("init");

        // --- Renderer setup (lightweight, main thread) ---
        const renderer = new Renderer({
          alpha: false,
          antialias: true,
          // Cap DPR at 1.5. The 450-cloud soft volumetric array does not need
          // 4K/Retina sharp 3.0x pixel precision, which saves billions of fragment calculations.
          dpr: Math.min(window.devicePixelRatio, 1.5),
          powerPreference: "high-performance",
        });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 1);
        gl.canvas.classList.add(styles.canvas);
        containerRef.current.appendChild(gl.canvas);

        const camera = new Camera(gl, { fov: 60, near: 0.1, far: 5000 });
        camera.position.z = 500;
        const scene = new Transform();

        const handleResize = () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          // Render at 70% resolution to drastically save GPU fill-rate on ultra-wide screens.
          // CSS will automatically scale the canvas up to fill the viewport seamlessly.
          renderer.setSize(w * 0.7, h * 0.7);
          gl.canvas.style.width = '100%';
          gl.canvas.style.height = '100%';
          camera.perspective({ aspect: w / h }); // Maintain true aspect ratio
        };
        window.addEventListener("resize", handleResize);
        handleResize();

        const observer = new IntersectionObserver(
          ([entry]) => {
            const wasVisible = isVisibleRef.current;
            isVisibleRef.current = entry.isIntersecting;
            if (
              entry.isIntersecting &&
              !wasVisible &&
              frameIdRef.current === 0
            ) {
              lastTimeRef.current = performance.now();
              frameIdRef.current = requestAnimationFrame(animate);
            }
          },
          { threshold: 0 }
        );
        if (containerRef.current) observer.observe(containerRef.current);

        // Scene objects — null until worker data arrives
        let nebulaMat: Program | null = null;
        let instancedNebula: Mesh | null = null;
        let starMat: Program | null = null;
        let starSystem: Mesh | null = null;
        let starDrawCount = 0;

        // Pre-allocated star buffers (filled progressively)
        let starPositions: Float32Array | null = null;
        let starColors: Float32Array | null = null;
        let starSizes: Float32Array | null = null;
        let starPhases: Float32Array | null = null;
        let starFreqs: Float32Array | null = null;
        let starExtras: Float32Array | null = null;

        type ShootingStar = Mesh & {
          userData: { velocity: Vec3; life: number; active: boolean };
        };
        const shootingStarPool: ShootingStar[] = [];

        const buildNebula = (cloudBitmap: ImageBitmap) => {
          const cloudTexture = new Texture(gl, {
            image: cloudBitmap as unknown as HTMLImageElement,
            generateMipmaps: false,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
          });

          // Dropped back to 150 to eliminate massive transparent overdraw jank.
          // We'll compensate by increasing the base alpha multiplier instead.
          const cloudCount = 150;

          const vertices = new Float32Array([
            -0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0,
          ]);
          const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
          const index = new Uint16Array([0, 1, 2, 2, 1, 3]);

          const aOffset = new Float32Array(cloudCount * 3);
          const aScale = new Float32Array(cloudCount);
          const aRotY = new Float32Array(cloudCount);
          const aRotZ = new Float32Array(cloudCount);
          const aColor = new Float32Array(cloudCount * 3);
          const aData = new Float32Array(cloudCount * 4);

          // Aurora generation logic delegated to spaceWorker.ts

          const nebulaGeo = new Geometry(gl, {
            position: { size: 3, data: vertices },
            uv: { size: 2, data: uvs },
            index: { data: index },
            aOffset: { instanced: 1, size: 3, data: aOffset },
            aScale: { instanced: 1, size: 1, data: aScale },
            aRotY: { instanced: 1, size: 1, data: aRotY },
            aRotZ: { instanced: 1, size: 1, data: aRotZ },
            aColor: { instanced: 1, size: 3, data: aColor },
            aData: { instanced: 1, size: 4, data: aData },
          });

          nebulaMat = new Program(gl, {
            vertex: `
            precision mediump float;
            attribute vec3 position;
            attribute vec2 uv;
            attribute vec3 aOffset;
            attribute float aScale;
            attribute float aRotY;
            attribute float aRotZ;
            attribute vec3 aColor;
            attribute vec4 aData;

            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            uniform float uTime;
            uniform float uLocalCameraY;

            varying vec2 vUv;
            varying vec3 vColor;
            varying float vOpacity;
            varying float vPhase;
            varying float vFogDepth;
            varying float vDepth;
            varying float vGlobalY;

            void main() {
              vUv = uv;
              vColor = aColor;
              
              // Pass the raw global Y position before it gets wrapped for infinite scrolling
              vGlobalY = aOffset.y;
              
              float speed = aData.x;
              float phase = aData.y;
              float baseOpacity = aData.z;
              vPhase = phase;
              
              float slow = sin(uTime * speed * 0.4 + phase);
              float med = sin(uTime * speed * 1.2 + phase * 2.0 + 0.5);
              float fast = sin(uTime * speed * 3.0 + phase * 3.7);
              
              float surgeWave = sin(uTime * 0.3 - phase * 4.0);
              float surge = pow(max(0.0, surgeWave), 2.0);
              
              float combinedPulse = (slow + 0.5 * med + 0.25 * fast) / 1.75;
              float brightness = 0.8 + 0.4 * combinedPulse + surge * 0.4;
              
              float entranceDelay = 0.3;
              float entranceProgress = clamp((uTime - entranceDelay) * 1.5, 0.0, 1.0);
              vOpacity = baseOpacity * brightness * entranceProgress;
              
              float scalePulse = 1.0 + 0.08 * combinedPulse + surge * 0.15;
              vec3 scaledPos = position * (aScale * scalePulse);
              
              vec3 wrappedOffset = aOffset;
              float wrapRange = 4000.0;
              wrappedOffset.y = mod(wrappedOffset.y - uLocalCameraY + wrapRange / 2.0, wrapRange) - wrapRange / 2.0 + uLocalCameraY;
              
              vec4 mvPosition = modelViewMatrix * vec4(wrappedOffset, 1.0);
              float s = sin(aRotZ);
              float c = cos(aRotZ);
              vec2 rotatedXY = vec2(
                 scaledPos.x * c - scaledPos.y * s,
                 scaledPos.x * s + scaledPos.y * c
              );
              mvPosition.xy += rotatedXY;
              vFogDepth = -mvPosition.z;
              vDepth = length(wrappedOffset);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
            fragment: `
            precision mediump float;
            uniform sampler2D uMap;
            uniform float uTime;
            uniform float uLocalCameraY;
            varying vec2 vUv;
            varying vec3 vColor;
            varying float vOpacity;
            varying float vPhase;
            varying float vFogDepth;
            varying float vDepth;
            varying float vGlobalY;

            vec2 hash(vec2 p) {
              p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
              return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
            }
            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(mix(dot(hash(i), f),
                             dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                         mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                             dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
            }
            float fbm(vec2 p) {
              float v = 0.0;
              // 1-Octave Noise. Because the clouds are heavily smoothed/blurred,
              // fine high-frequency details from additional octaves are invisible
              // and unnecessarily double the fragment math payload per pixel.
              v += 0.5 * noise(p); 
              return v;
            }

            void main() {
              vec4 texColor = texture2D(uMap, vUv);
              
              // Smooth, fluid time animation
              vec2 timeShift = vec2(uTime * 0.4, uTime * 0.2) + vPhase;
              
              // 1. Distort UVs smoothly
              vec2 noiseUv = vUv * 3.5 + timeShift;
              float n = fbm(noiseUv);
              float nNorm = n * 0.5 + 0.5;
              
              // 2. "Slick" Contrast Curve
              // Softened the bounding curve so shapes are much less obvious/distinct
              float slickNoise = smoothstep(0.0, 1.0, nNorm);
              
              // 3. Dynamic iridescent shift
              float iridescence = sin(uTime * 1.0 + vDepth * 5.0 + n * 4.0) * 0.5 + 0.5;
              // Softer, deeper colors at the core
              vec3 coreBase = mix(vec3(0.0, 0.2, 0.6), vec3(0.5, 0.1, 0.4), iridescence); 
              
              vec3 shifted = mix(vColor, coreBase, slickNoise * 0.7);

              // 4. Slick Highlights
              // Darkened the highlights down significantly since we have 3x as many clouds overlapping
              float highlight = 0.15 + (0.5 * slickNoise);
              
              // 5. Elegant Scintillation
              float flickerMask = smoothstep(0.2, 1.0, nNorm);
              float flickerPulse = sin(uTime * 3.0 + vPhase * 2.0 + n * 8.0) * 0.5 + 0.5;
              float flicker = flickerMask * flickerPulse * 0.6;
              
              // 6. Premium Alpha Blending
              // Boosted the base alpha multiplier up to 1.5 to compensate for dropping 
              // the cloud count back to 150, keeping the dense volumetric look alive.
              float alpha = texColor.a * vOpacity * (highlight + flicker) * 1.5;
              
              float fogFactor = exp2( -0.0003 * 0.0003 * vFogDepth * vFogDepth * 1.442695 );
              fogFactor = clamp( fogFactor, 0.0, 1.0 );
              float nearFade = smoothstep(50.0, 350.0, vFogDepth);
              
              gl_FragColor = vec4(shifted, alpha * fogFactor * nearFade);
            }
          `,
            uniforms: {
              uMap: { value: cloudTexture },
              uTime: { value: 0 },
              uLocalCameraY: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
          });
          nebulaMat.blendFunc = { src: gl.SRC_ALPHA, dst: gl.ONE };

          instancedNebula = new Mesh(gl, {
            geometry: nebulaGeo,
            program: nebulaMat,
            frustumCulled: false,
          });
          instancedNebula.setParent(scene);
        };

        const buildStarfield = (totalCount: number) => {
          starPositions = new Float32Array(totalCount * 3);
          starColors = new Float32Array(totalCount * 3);
          starSizes = new Float32Array(totalCount);
          starPhases = new Float32Array(totalCount);
          starFreqs = new Float32Array(totalCount);
          starExtras = new Float32Array(totalCount * 4);

          const starGeo = new Geometry(gl, {
            position: { size: 3, data: starPositions },
            color: { size: 3, data: starColors },
            size: { size: 1, data: starSizes },
            phase: { size: 1, data: starPhases },
            frequency: { size: 1, data: starFreqs },
            extraData: { size: 4, data: starExtras },
          });

          starMat = new Program(gl, {
            vertex: `
            attribute vec3 position;
            attribute float size;
            attribute float phase;
            attribute vec4 extraData;
            attribute float frequency;
            attribute vec3 color;

            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            uniform float uTime;
            uniform float uPixelRatio;
            uniform float uLocalCameraY;

            varying float vAlpha;
            varying float vGlow;
            varying vec3 vColor;
            varying float vFogDepth;

            void main() {
              vec3 wrappedPos = position;
              float wrapRange = 4000.0;
              wrappedPos.y = mod(wrappedPos.y - uLocalCameraY + wrapRange / 2.0, wrapRange) - wrapRange / 2.0 + uLocalCameraY;

              vec4 mvPosition = modelViewMatrix * vec4(wrappedPos, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              vFogDepth = -mvPosition.z;
              
              gl_PointSize = size * uPixelRatio * (600.0 / -mvPosition.z);
              gl_PointSize = max(gl_PointSize, 2.0 * uPixelRatio); 
              
              vAlpha = extraData.z; 
              vGlow = extraData.x;
              
              float isTwink = extraData.y;
              float twinkleBase = 0.75 + 0.25 * sin(uTime * frequency + phase); 
              float twinkle = mix(1.0, twinkleBase, isTwink);
              
              vAlpha = vAlpha * (0.4 + 1.0 * twinkle); 
              // A touch larger than original (original was 0.9 + 0.2)
              gl_PointSize = gl_PointSize * (0.95 + 0.25 * twinkle); 
              
              float scin = extraData.w;
              float flicker = sin(uTime * 6.0 + phase * 10.0); 
              vec3 scinColor = color * (1.0 + flicker * 0.1 * scin);
              vColor = mix(color, scinColor, scin);
            }
          `,
            fragment: `
            precision highp float;
            varying float vAlpha;
            varying float vGlow;
            varying vec3 vColor;
            varying float vFogDepth;

            void main() {
              vec2 coord = gl_PointCoord - vec2(0.5);
              float dist = length(coord);
              if(dist > 0.5) discard;
              
              float alpha = 1.0 - smoothstep(0.0, 0.48, dist);
              float glow = vGlow * (1.0 - smoothstep(0.0, 0.5, dist)) * 0.6;
              
              // Increased from 0.7 back up to 0.9 for a *tiny* bit more brightness
              float outAlpha = (alpha + glow) * vAlpha * 0.9;
              float fogFactor = exp2( -0.0003 * 0.0003 * vFogDepth * vFogDepth * 1.442695 );
              fogFactor = clamp( fogFactor, 0.0, 1.0 );
              
              gl_FragColor = vec4(vColor, outAlpha * fogFactor);
            }
          `,
            uniforms: {
              uTime: { value: 0 },
              uPixelRatio: { value: renderer.dpr },
              uLocalCameraY: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
          });
          starMat.blendFunc = { src: gl.SRC_ALPHA, dst: gl.ONE };

          starSystem = new Mesh(gl, {
            mode: gl.POINTS,
            geometry: starGeo,
            program: starMat,
            frustumCulled: false,
          });
          starSystem.setParent(scene);
        };

        const buildShootingStars = () => {
          const poolSize = 8;
          const shootingStarsRoot = new Transform();
          shootingStarsRoot.setParent(scene);

          for (let i = 0; i < poolSize; i++) {
            const lineGeo = new Geometry(gl, {
              position: { size: 3, data: new Float32Array(6) },
              color: { size: 3, data: new Float32Array(6) },
            });
            const lineMat = new Program(gl, {
              vertex: `
              attribute vec3 position;
              attribute vec3 color;
              uniform mat4 modelViewMatrix;
              uniform mat4 projectionMatrix;
              varying vec3 vColor;
              void main() {
                vColor = color;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
              fragment: `
              precision highp float;
              varying vec3 vColor;
              uniform float uOpacity;
              void main() {
                gl_FragColor = vec4(vColor, uOpacity);
              }
            `,
              uniforms: { uOpacity: { value: 0 } },
              transparent: true,
              depthWrite: false,
            });
            lineMat.blendFunc = { src: gl.SRC_ALPHA, dst: gl.ONE };

            const line = new Mesh(gl, {
              mode: gl.LINES,
              geometry: lineGeo,
              program: lineMat,
            }) as ShootingStar;
            line.userData = { velocity: new Vec3(), life: 0, active: false };
            line.setParent(shootingStarsRoot);
            line.position.set(0, -9999, 0);
            shootingStarPool.push(line);
          }
        };

        // Build nebula + scene immediately (no worker dependency)
        const cloudCanvas = document.createElement("canvas");
        cloudCanvas.width = 512;
        cloudCanvas.height = 512;
        const cloudCtx = cloudCanvas.getContext("2d")!;
        const cx = 256;
        const grad = cloudCtx.createRadialGradient(cx, cx, 0, cx, cx, cx);
        grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
        grad.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
        grad.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
        grad.addColorStop(0.8, "rgba(255, 255, 255, 0.05)");
        grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
        cloudCtx.fillStyle = grad;
        cloudCtx.fillRect(0, 0, 512, 512);

        // Input handlers
        const handleMouseMove = (e: MouseEvent) => {
          // Use innerHeight for both to ensure left/right tracks at the exact same geometric speed as up/down
          mouseRef.current = {
            x: (e.clientX / window.innerHeight) * 2 - 1,
            y: -(e.clientY / window.innerHeight) * 2 + 1,
          };
        };
        window.addEventListener("mousemove", handleMouseMove);

        let slowFrameCount = 0;

        // Animation Loop
        function animate(now: number) {
          if (!isVisibleRef.current) {
            frameIdRef.current = 0;
            return;
          }

          const rawDelta = now - lastTimeRef.current;
          lastTimeRef.current = now;

          frameIdRef.current = requestAnimationFrame(animate);

          if (rawDelta > 50) {
            slowFrameCount++;
            if (slowFrameCount > 10) return;
          } else {
            slowFrameCount = Math.max(0, slowFrameCount - 1);
          }

          const deltaTime = Math.min(rawDelta / 1000, 0.1);
          const t = now * 0.001;

          const actualScroll = actualScrollRef.current;
          // Spin starts immediately and accelerates with scroll
          targetRotationRef.current =
            (Math.max(0, actualScroll) / 1000) ** 1.2 * 0.5;

          const rotationLerp = 1 - 0.01 ** deltaTime;
          currentRotationRef.current +=
            (targetRotationRef.current - currentRotationRef.current) *
            rotationLerp;

          const parallaxLerp = 1 - 0.001 ** deltaTime;
          currentParallaxRef.current +=
            (targetParallaxRef.current - currentParallaxRef.current) *
            parallaxLerp;
          const targetCamY = targetCameraPos.current.y;
          const scrollParallax = currentParallaxRef.current * 1000;
          // Keep the camera looking horizontally to prevent extreme diagonal fog distances
          const tiltAmount = 0;
          const wrapCenterWorldY = targetCamY;

          if (starMat && starSystem) {
            starMat.uniforms.uTime.value = t;
            starSystem.rotation.y = currentRotationRef.current * 0.8;
            starSystem.position.y = scrollParallax;
            starMat.uniforms.uLocalCameraY.value =
              wrapCenterWorldY - starSystem.position.y;
          }

          if (nebulaMat && instancedNebula) {
            nebulaMat.uniforms.uTime.value = t;
            instancedNebula.rotation.z = t * 0.01;
            instancedNebula.position.y = scrollParallax * 0.85;
            nebulaMat.uniforms.uLocalCameraY.value =
              wrapCenterWorldY - instancedNebula.position.y;
          }

          if (Math.random() < 0.015) {
            const star = shootingStarPool.find((s) => !s.userData.active);
            if (star) {
              const trailLength = 10 + Math.random() * 20;
              const posData = star.geometry.attributes.position
                .data as Float32Array;
              posData[0] = -trailLength;
              posData[1] = 0;
              posData[2] = 0;
              posData[3] = 0;
              posData[4] = 0;
              posData[5] = 0;
              star.geometry.attributes.position.needsUpdate = true;
              const colData = star.geometry.attributes.color
                .data as Float32Array;
              colData[0] = 0;
              colData[1] = 0;
              colData[2] = 0;
              colData[3] = 1;
              colData[4] = 1;
              colData[5] = 1;
              star.geometry.attributes.color.needsUpdate = true;
              const speed = Math.random() * 10 + 20;
              const angle = -Math.PI / 6 - Math.random() * (Math.PI / 4);
              star.userData.velocity.set(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                0,
              );
              star.position.set(
                (Math.random() - 0.5) * 2000,
                targetCamY + scrollParallax + (Math.random() - 0.5) * 1200,
                (Math.random() - 0.5) * 400 - 100,
              );
              star.rotation.z = angle;
              star.userData.life = 1.0;
              star.userData.active = true;
              star.program.uniforms.uOpacity.value = 1.0;
            }
          }

          const lifeDecay = 1.2 * deltaTime;
          const speedFactor = 60 * deltaTime;
          for (const star of shootingStarPool) {
            if (!star.userData.active) continue;
            star.position.x += star.userData.velocity.x * speedFactor;
            star.position.y += star.userData.velocity.y * speedFactor;
            star.userData.life -= lifeDecay;
            star.program.uniforms.uOpacity.value = Math.max(
              0,
              star.userData.life,
            );
            if (star.userData.life <= 0) {
              star.userData.active = false;
              star.position.set(0, -9999, 0);
            }
          }

          const mouseFactor = 1 - 0.0001 ** deltaTime;
          targetCameraPos.current.x +=
            (mouseRef.current.x * 20 - targetCameraPos.current.x) * mouseFactor;
          targetCameraPos.current.y +=
            (mouseRef.current.y * 20 - targetCameraPos.current.y) * mouseFactor;
          const tOrbit = t * 0.02;
          const radius = 500;
          const orbitalX =
            Math.sin(currentRotationRef.current + tOrbit) * radius;
          const orbitalZ =
            Math.cos(currentRotationRef.current + tOrbit) * radius;
          camera.position.set(
            orbitalX + targetCameraPos.current.x,
            targetCamY,
            orbitalZ,
          );
          camera.lookAt([0, -tiltAmount, 0]);
          renderer.render({ scene, camera });
        }

        // Build scene and start rendering immediately
        buildNebula(cloudCanvas as unknown as ImageBitmap);
        // Reduced from 100,000 down to 20,000 to eliminate a massive GPU rasterizer 
        // string bottleneck caused by drawing 100k transparent quads on top of each other.
        buildStarfield(20000);
        buildShootingStars();

        gl.canvas.classList.add(styles.canvasReady);
        animate(performance.now());

        // --- Handle progressive star data from worker ---
        worker.onmessage = (e: MessageEvent) => {
          if (e.data.type === "auroras") {
            if (instancedNebula) {
              const geo = instancedNebula.geometry;
              geo.attributes.aOffset.data!.set(e.data.aOffset);
              geo.attributes.aScale.data!.set(e.data.aScale);
              geo.attributes.aRotY.data!.set(e.data.aRotY);
              geo.attributes.aRotZ.data!.set(e.data.aRotZ);
              geo.attributes.aColor.data!.set(e.data.aColor);
              geo.attributes.aData.data!.set(e.data.aData);
              geo.attributes.aOffset.needsUpdate = true;
              geo.attributes.aScale.needsUpdate = true;
              geo.attributes.aRotY.needsUpdate = true;
              geo.attributes.aRotZ.needsUpdate = true;
              geo.attributes.aColor.needsUpdate = true;
              geo.attributes.aData.needsUpdate = true;
            }
            return;
          }

          const {
            offset,
            count,
            positions,
            colors,
            sizes,
            phases,
            freqs,
            extras,
          } = e.data;
          if (
            !starPositions ||
            !starColors ||
            !starSizes ||
            !starPhases ||
            !starFreqs ||
            !starExtras
          )
            return;

          starPositions.set(positions, offset * 3);
          starColors.set(colors, offset * 3);
          starSizes.set(sizes, offset);
          starPhases.set(phases, offset);
          starFreqs.set(freqs, offset);
          starExtras.set(extras, offset * 4);

          starDrawCount = offset + count;

          if (starSystem) {
            for (const attr of Object.values(starSystem.geometry.attributes)) {
              (attr as { needsUpdate: boolean }).needsUpdate = true;
            }
            starSystem.geometry.drawRange = { start: 0, count: starDrawCount };
          }

          if (starDrawCount >= starPositions.length) {
            worker.terminate();
          }
        };

        cleanupFunc = () => {
          worker.terminate();
          observer.disconnect();
          window.removeEventListener("resize", handleResize);
          window.removeEventListener("mousemove", handleMouseMove);
          if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
          if (gl.canvas.parentNode) gl.canvas.parentNode.removeChild(gl.canvas);
          const loseContext = gl.getExtension("WEBGL_lose_context");
          if (loseContext) loseContext.loseContext();
        };
      };

      timeoutId = setTimeout(initWebGL, 100);

      return () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        cleanupFunc?.();
      };
    }, []);

    return (
      <div ref={containerRef} className={styles.container}>
        <div className={styles.gradient} />
      </div>
    );
  },
);
