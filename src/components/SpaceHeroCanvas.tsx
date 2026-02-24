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
import type React from "react";
import { useEffect, useRef } from "react";
import styles from "./SpaceHeroCanvas.module.css";

export function SpaceHeroCanvas(): React.JSX.Element {
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
    const handleScroll = () => {
      if (!containerRef.current) return;
      const vh = window.innerHeight;
      const scrollY = window.scrollY;
      targetParallaxRef.current = scrollY / vh;
      actualScrollRef.current = scrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let cleanupFunc: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const initWebGL = () => {
      if (!containerRef.current) return;

      // Kick off heavy computation in a Web Worker immediately
      const worker = new Worker(new URL("./spaceWorker.ts", import.meta.url), {
        type: "module",
      });
      worker.postMessage("init");

      // --- Renderer setup (lightweight, main thread) ---
      const renderer = new Renderer({
        alpha: false,
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
        renderer.setSize(w, h);
        camera.perspective({ aspect: w / h });
      };
      window.addEventListener("resize", handleResize);
      handleResize();

      const observer = new IntersectionObserver(
        ([entry]) => {
          const wasVisible = isVisibleRef.current;
          isVisibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting && !wasVisible && frameIdRef.current === 0) {
            lastTimeRef.current = performance.now();
            frameIdRef.current = requestAnimationFrame(animate);
          }
        },
        { threshold: 0 },
      );
      if (containerRef.current) observer.observe(containerRef.current);

      // Scene objects — null until worker data arrives
      let nebulaMat: Program | null = null;
      let instancedNebula: Mesh | null = null;
      let starMat: Program | null = null;
      let starSystem: Mesh | null = null;

      type ShootingStar = Mesh & {
        userData: { velocity: Vec3; life: number; active: boolean };
      };
      const shootingStarPool: ShootingStar[] = [];

      // --- Build scene when worker delivers computed data ---
      worker.onmessage = (e: MessageEvent) => {
        const { positions, colors, sizes, phases, freqs, extras, cloudBitmap } =
          e.data;
        worker.terminate();

        // -- Nebula --
        const cloudTexture = new Texture(gl, {
          image: cloudBitmap,
          generateMipmaps: false,
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
        });

        const nebulaColors = [
          [123 / 255, 47 / 255, 202 / 255],
          [6 / 255, 95 / 255, 70 / 255],
          [83 / 255, 72 / 255, 184 / 255],
          [22 / 255, 78 / 255, 99 / 255],
        ];
        const cloudCount = 50;

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

        for (let i = 0; i < cloudCount; i++) {
          const color =
            nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
          const opacity = 0.045 + Math.random() * 0.12;
          const scale = 500 + Math.random() * 700;

          const angleStep = (Math.PI * 2) / cloudCount;
          const angle = i * angleStep + (Math.random() - 0.5) * angleStep * 0.8;
          const dist = 400 + Math.random() * 600;

          aOffset.set(
            [
              Math.cos(angle) * dist,
              (Math.random() - 0.5) * 1000,
              Math.sin(angle) * dist,
            ],
            i * 3,
          );

          aScale[i] = scale;
          aRotY[i] = angle + Math.PI;
          aRotZ[i] = Math.random() * Math.PI * 2;

          aColor.set(color, i * 3);
          aData.set(
            [
              0.05 + Math.random() * 0.05,
              Math.random() * Math.PI * 2,
              opacity,
              0,
            ],
            i * 4,
          );
        }

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

            varying vec2 vUv;
            varying vec3 vColor;
            varying float vOpacity;
            varying float vPhase;
            varying float vFogDepth;

            void main() {
              vUv = uv;
              vColor = aColor;
              
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
              
              float entranceDelay = 1.0;
              float entranceProgress = clamp((uTime - entranceDelay) * 0.5, 0.0, 1.0);
              vOpacity = baseOpacity * brightness * entranceProgress;
              
              float scalePulse = 1.0 + 0.08 * combinedPulse + surge * 0.15;
              vec3 scaledPos = position * (aScale * scalePulse);
              
              vec4 mvPosition = modelViewMatrix * vec4(aOffset, 1.0);
              float s = sin(aRotZ);
              float c = cos(aRotZ);
              vec2 rotatedXY = vec2(
                 scaledPos.x * c - scaledPos.y * s,
                 scaledPos.x * s + scaledPos.y * c
              );
              mvPosition.xy += rotatedXY;
              vFogDepth = -mvPosition.z;
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragment: `
            precision highp float;
            uniform sampler2D uMap;
            uniform float uTime;
            varying vec2 vUv;
            varying vec3 vColor;
            varying float vOpacity;
            varying float vPhase;
            varying float vFogDepth;

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
              v += 0.5 * noise(p); p *= 2.1;
              v += 0.25 * noise(p);
              return v;
            }

            void main() {
              vec4 texColor = texture2D(uMap, vUv);
              float shift = sin(uTime * 0.15 + vPhase) * 0.15;
              vec3 shifted = vColor + vec3(shift * 0.3, shift * -0.1, shift * 0.2);
              vec2 noiseUv = vUv * 4.0 + vec2(uTime * 0.8, uTime * 0.5) + vPhase;
              float n = fbm(noiseUv);
              float nNorm = n * 0.5 + 0.5;
              float highlight = 0.4 + 0.6 * nNorm;
              float flickerMask = smoothstep(0.55, 0.75, nNorm);
              float flickerPulse = sin(uTime * 1.5 + vPhase * 3.0 + n * 6.0) * 0.5 + 0.5;
              float flicker = flickerMask * flickerPulse * 0.6;
              float alpha = texColor.a * vOpacity * (highlight + flicker);
              float fogFactor = exp2( -0.0003 * 0.0003 * vFogDepth * vFogDepth * 1.442695 );
              fogFactor = clamp( fogFactor, 0.0, 1.0 );
              gl_FragColor = vec4(shifted, alpha * fogFactor);
            }
          `,
          uniforms: {
            uMap: { value: cloudTexture },
            uTime: { value: 0 },
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

        // -- Starfield (using pre-computed arrays from worker) --
        const starGeo = new Geometry(gl, {
          position: { size: 3, data: positions },
          color: { size: 3, data: colors },
          size: { size: 1, data: sizes },
          phase: { size: 1, data: phases },
          frequency: { size: 1, data: freqs },
          extraData: { size: 4, data: extras },
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

            varying float vAlpha;
            varying float vGlow;
            varying vec3 vColor;
            varying float vFogDepth;

            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
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
              gl_PointSize = gl_PointSize * (0.9 + 0.2 * twinkle); 
              
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
              
              float outAlpha = (alpha + glow) * vAlpha;
              float fogFactor = exp2( -0.0003 * 0.0003 * vFogDepth * vFogDepth * 1.442695 );
              fogFactor = clamp( fogFactor, 0.0, 1.0 );
              
              gl_FragColor = vec4(vColor, outAlpha * fogFactor);
            }
          `,
          uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: renderer.dpr },
          },
          transparent: true,
          depthWrite: false,
        });
        starMat.blendFunc = { src: gl.SRC_ALPHA, dst: gl.ONE };

        starSystem = new Mesh(gl, {
          mode: gl.POINTS,
          geometry: starGeo,
          program: starMat,
        });
        starSystem.setParent(scene);

        // -- Shooting Stars --
        const poolSize = 20;
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

        // -- Finalize --
        gl.canvas.classList.add(styles.canvasReady);
        animate(performance.now());
      };

      // Input handlers
      const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current = {
          x: (e.clientX / window.innerWidth) * 2 - 1,
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
        const scrollY = -currentParallaxRef.current * 1000;

        if (starMat && starSystem) {
          starMat.uniforms.uTime.value = t;
          starSystem.rotation.y = currentRotationRef.current * 0.8;
          starSystem.position.y = scrollY * 0.85;
        }

        if (nebulaMat && instancedNebula) {
          nebulaMat.uniforms.uTime.value = t;
          instancedNebula.rotation.z = t * 0.01;
          instancedNebula.position.y = scrollY * 0.85;
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
            const colData = star.geometry.attributes.color.data as Float32Array;
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
              (Math.random() - 0.5) * 1200,
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
          (mouseRef.current.x * 50 - targetCameraPos.current.x) * mouseFactor;
        targetCameraPos.current.y +=
          (mouseRef.current.y * 50 - targetCameraPos.current.y) * mouseFactor;
        const tOrbit = t * 0.02;
        const radius = 500;
        const orbitalX = Math.sin(currentRotationRef.current + tOrbit) * radius;
        const orbitalZ = Math.cos(currentRotationRef.current + tOrbit) * radius;
        camera.position.set(
          orbitalX + targetCameraPos.current.x,
          scrollY + targetCameraPos.current.y,
          orbitalZ,
        );
        camera.lookAt([0, scrollY, 0]);
        renderer.render({ scene, camera });
      }

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
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (cleanupFunc) cleanupFunc();
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.gradient} />
    </div>
  );
}
