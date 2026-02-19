import React, { useEffect, useRef } from "react";
import {
	Texture,
	CanvasTexture,
	LinearFilter,
	Scene,
	PerspectiveCamera,
	WebGLRenderer,
	Points,
	Group,
	Color,
	FogExp2,
	AdditiveBlending,
	BufferGeometry,
	BufferAttribute,
	ShaderMaterial,
	Object3D,
	LineBasicMaterial,
	Line,
	Vector3,
	Material,
	InstancedMesh,
	InstancedBufferAttribute
} from "three";

// Generate a soft "cloud/puff" texture for the nebulae
function createCloudTexture(): Texture {
	const textWidth = 1024;
    const textHeight = 1024;
	const canvas = document.createElement("canvas");
	canvas.width = textWidth;
	canvas.height = textHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) return new Texture();

	const cx = textWidth / 2;
    const cy = textHeight / 2;
	const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
	grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
    grad.addColorStop(0.2, "rgba(255, 255, 255, 0.8)"); 
	grad.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
    grad.addColorStop(0.8, "rgba(255, 255, 255, 0.05)");
	grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");

	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, textWidth, textHeight);

	// Add noise/grain for texture
	const imageData = ctx.getImageData(0, 0, textWidth, textHeight);
	const data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		const noise = (Math.random() - 0.5) * 30;
		data[i] = Math.min(255, Math.max(0, data[i] + noise));
		data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
		data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
	}
	ctx.putImageData(imageData, 0, 0);

	const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
	return texture;
}

export function SpaceHeroCanvas(): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement>(null);

	// Refs
	const sceneRef = useRef<Scene | null>(null);
	const cameraRef = useRef<PerspectiveCamera | null>(null);
	const rendererRef = useRef<WebGLRenderer | null>(null);
	const frameIdRef = useRef<number>(0);
	const isVisibleRef = useRef<boolean>(true);
    const lastTimeRef = useRef<number>(0);

	const starSystemRef = useRef<Points | null>(null);
	const nebulaRef = useRef<InstancedMesh | null>(null);
	const shootingStarsRef = useRef<Group | null>(null);

    // Pooling for shooting stars
    const poolSize = 20;
    const shootingStarPoolRef = useRef<Line[]>([]);

	const mouseRef = useRef({ x: 0, y: 0 });
	const mouseInitializedRef = useRef(false);
	const targetCameraPos = useRef({ x: 0, y: 0 });
	const targetParallaxRef = useRef(0);
	const currentParallaxRef = useRef(0);
	const targetRotationRef = useRef(0);
	const currentRotationRef = useRef(0);

	useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;
            const vh = window.innerHeight;
            targetParallaxRef.current = window.scrollY / vh;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		if (!containerRef.current) return;

		// Visibility Observer to stop/start animation loop
		const observer = new IntersectionObserver(
			([entry]) => {
				const wasVisible = isVisibleRef.current;
				isVisibleRef.current = entry.isIntersecting;
				
				// Re-start loop if it was stopped and we became visible
				if (entry.isIntersecting && !wasVisible && frameIdRef.current === 0) {
                    lastTimeRef.current = performance.now();
					frameIdRef.current = requestAnimationFrame(animate);
				}
			},
			{ threshold: 0 }
		);
		observer.observe(containerRef.current);

		const width = containerRef.current.clientWidth;
		const height = containerRef.current.clientHeight;

		const scene = new Scene();
		scene.background = new Color("#000000");
		scene.fog = new FogExp2(0x000000, 0.0003);

		const camera = new PerspectiveCamera(60, width / height, 0.1, 2000);
		camera.position.z = 500;

		const renderer = new WebGLRenderer({
			alpha: false,
			antialias: false, 
			powerPreference: "high-performance",
		});
		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
		containerRef.current.appendChild(renderer.domElement);

		sceneRef.current = scene;
		cameraRef.current = camera;
		rendererRef.current = renderer;

		// Initialize Shooting Star Pool
		const shootingStars = new Group();
		scene.add(shootingStars);
		shootingStarsRef.current = shootingStars;
        
        for (let i = 0; i < poolSize; i++) {
            const geometry = new BufferGeometry();
            const positions = new Float32Array(6); // 2 points
            const colors = new Float32Array(6);
            geometry.setAttribute('position', new BufferAttribute(positions, 3));
            geometry.setAttribute('color', new BufferAttribute(colors, 3));
            const material = new LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0,
                blending: AdditiveBlending,
                visible: false
            });
            const line = new Line(geometry, material);
            shootingStarPoolRef.current.push(line);
            shootingStars.add(line);
        }

		// 1. NEBULA SYSTEM (Instanced)
		const cloudTexture = createCloudTexture();
		const nebulaColors = [
			new Color("#4c1d95"),
			new Color("#065f46"),
			new Color("#312e81"),
			new Color("#164e63"),
		];
		const cloudCount = 50; 
		
		const nebulaGeo = new BufferGeometry();
		const vertices = new Float32Array([-0.5,-0.5,0,  0.5,-0.5,0,  0.5,0.5,0,  -0.5,-0.5,0,  0.5,0.5,0,  -0.5,0.5,0]);
		const uvs = new Float32Array([0,0, 1,0, 1,1, 0,0, 1,1, 0,1]);
		nebulaGeo.setAttribute('position', new BufferAttribute(vertices, 3));
		nebulaGeo.setAttribute('uv', new BufferAttribute(uvs, 2));

        const instanceMatrix = new InstancedBufferAttribute(new Float32Array(cloudCount * 16), 16);
        const aColor = new InstancedBufferAttribute(new Float32Array(cloudCount * 3), 3);
        const aData = new InstancedBufferAttribute(new Float32Array(cloudCount * 4), 4); // x: speed, y: phase, z: opacity, w: scale

        const dummy = new Object3D();
		for (let i = 0; i < cloudCount; i++) {
			const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
			const opacity = 0.07 + Math.random() * 0.13;
			const scale = 500 + Math.random() * 700; 
            
            dummy.position.set((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 1000, -200 - Math.random() * 800);
            dummy.rotation.z = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scale, 1);
            dummy.updateMatrix();
            dummy.matrix.toArray(instanceMatrix.array, i * 16);

            aColor.setXYZ(i, color.r, color.g, color.b);
            aData.setXYZW(i, 0.05 + Math.random() * 0.05, Math.random() * Math.PI * 2, opacity, scale);
		}

        const nebulaMat = new ShaderMaterial({
            uniforms: {
                uMap: { value: cloudTexture },
                uTime: { value: 0 },
            },
            vertexShader: `
                attribute vec4 aData; // x: speed, y: phase, z: opacity, w: scale
                attribute vec3 aColor;
                varying vec2 vUv;
                varying vec3 vColor;
                varying float vOpacity;
                uniform float uTime;

                void main() {
                    vUv = uv;
                    vColor = aColor;
                    
                    float speed = aData.x;
                    float phase = aData.y;
                    float baseOpacity = aData.z;
                    
                    float pulse1 = sin(uTime * speed + phase);
                    float pulse2 = sin(uTime * speed * 2.3 + phase + 1.0);
                    float combinedPulse = (pulse1 + 0.5 * pulse2) / 1.5;
                    
                    float entranceDelay = 1.0;
                    float entranceProgress = clamp((uTime - entranceDelay) * 0.5, 0.0, 1.0);
                    vOpacity = baseOpacity * (0.8 + 0.4 * combinedPulse) * entranceProgress;
                    
                    float scalePulse = 1.0 + 0.05 * combinedPulse;
                    vec3 scaledPos = position * scalePulse;
                    
                    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(scaledPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D uMap;
                varying vec2 vUv;
                varying vec3 vColor;
                varying float vOpacity;
                void main() {
                    vec4 texColor = texture2D(uMap, vUv);
                    gl_FragColor = vec4(vColor, texColor.a * vOpacity);
                }
            `,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
        });

        const instancedNebula = new InstancedMesh(nebulaGeo, nebulaMat, cloudCount);
        instancedNebula.instanceMatrix = instanceMatrix;
        nebulaGeo.setAttribute('aColor', aColor);
        nebulaGeo.setAttribute('aData', aData);
		scene.add(instancedNebula);
		nebulaRef.current = instancedNebula;

		// 2. STARFIELD
		const starCount = 12000; 
		const starGeo = new BufferGeometry();
		const positions = new Float32Array(starCount * 3);
		const starColorsArr = new Float32Array(starCount * 3);
		const sizes = new Float32Array(starCount);
		const phases = new Float32Array(starCount);
		const frequencies = new Float32Array(starCount);
		const extraData = new Float32Array(starCount * 4); // x: glow, y: twinkle, z: alpha, w: scintillation

		for (let i = 0; i < starCount; i++) {
			const r = 1000 + Math.random() * 1000;
			const theta = 2 * Math.PI * Math.random();
            const cosPhi = 1.0 - 2.0 * Math.pow(Math.random(), 1.8);
            const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
            
			positions[i * 3] = r * sinPhi * Math.cos(theta);
			positions[i * 3 + 1] = r * cosPhi;
			positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);
            
            const seed = Math.random();
            const colorSeed = Math.random();
			sizes[i] = seed < 0.8 ? 0.8 + Math.random() * 1.2 : 2.0 + Math.random() * 1.5;
			phases[i] = Math.random() * Math.PI * 2;
            frequencies[i] = 0.5 + Math.random() * 1.0; // Slightly faster breathing
            extraData[i * 4] = seed > 0.94 ? 1.0 : 0.0;
            extraData[i * 4 + 1] = Math.random() < 0.2 ? 1.0 : 0.0; // Normal twinkle rate
            extraData[i * 4 + 2] = 0.4 + Math.random() * 0.6; 
            extraData[i * 4 + 3] = Math.random() < 0.08 ? 0.2 + Math.random() * 0.2 : 0.0; 

            let cR=1.0, cG=1.0, cB=1.0;
            if (colorSeed < 0.04) { cR=0.7; cG=0.8; cB=1.0; }
            else if (colorSeed < 0.08) { cR=1.0; cG=0.9; cB=0.7; }
            starColorsArr[i * 3] = cR; starColorsArr[i * 3 + 1] = cG; starColorsArr[i * 3 + 2] = cB;
		}

		starGeo.setAttribute("position", new BufferAttribute(positions, 3));
		starGeo.setAttribute("color", new BufferAttribute(starColorsArr, 3));
		starGeo.setAttribute("size", new BufferAttribute(sizes, 1));
		starGeo.setAttribute("phase", new BufferAttribute(phases, 1));
		starGeo.setAttribute("frequency", new BufferAttribute(frequencies, 1));
		starGeo.setAttribute("extraData", new BufferAttribute(extraData, 4));

		const starMat = new ShaderMaterial({
			uniforms: {
				time: { value: 0 },
				pixelRatio: { value: renderer.getPixelRatio() }
			},
			vertexShader: `
				uniform float time;
				uniform float pixelRatio;
				attribute float size;
				attribute float phase;
				attribute vec4 extraData; // x: glow, y: isTwink, z: baseAlpha, w: scintillate
				attribute float frequency;
				attribute vec3 color;
				varying float vAlpha;
				varying float vGlow;
				varying vec3 vColor;
				void main() {
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					gl_Position = projectionMatrix * mvPosition;
					
					// SHIMMER PREVENTION: Increase min size and remove pulse animation
					gl_PointSize = size * pixelRatio * (600.0 / -mvPosition.z);
					gl_PointSize = max(gl_PointSize, 2.0 * pixelRatio); 
					
					vAlpha = extraData.z; 
					vGlow = extraData.x;
					
					// SELECTIVE TWINKLE (Subtle)
					float isTwink = extraData.y;
					float twinkleBase = 0.75 + 0.25 * sin(time * frequency + phase); 
                    float twinkle = mix(1.0, twinkleBase, isTwink);
                    
					vAlpha = vAlpha * (0.4 + 1.0 * twinkle); 
					gl_PointSize = gl_PointSize * (0.9 + 0.2 * twinkle); 
					
                    float scin = extraData.w;
                    float flicker = sin(time * 6.0 + phase * 10.0); 
                    vec3 scinColor = color * (1.0 + flicker * 0.1 * scin);
                    vColor = mix(color, scinColor, scin);
				}
			`,
			fragmentShader: `
				varying float vAlpha;
				varying float vGlow;
				varying vec3 vColor;
				void main() {
					vec2 coord = gl_PointCoord - vec2(0.5);
					float dist = length(coord);
					if(dist > 0.5) discard;
					
					// SOFTER EDGES to prevent shimmering
					float alpha = 1.0 - smoothstep(0.0, 0.48, dist);
					float glow = vGlow * (1.0 - smoothstep(0.0, 0.5, dist)) * 0.6;
					gl_FragColor = vec4(vColor, (alpha + glow) * vAlpha);
				}
			`,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});

		const starSystem = new Points(starGeo, starMat);
		starSystem.frustumCulled = false; // Always visible
		scene.add(starSystem);
		starSystemRef.current = starSystem;

		const handleMouseMove = (e: MouseEvent) => {
			const x = (e.clientX / window.innerWidth) * 2 - 1;
			const y = -(e.clientY / window.innerHeight) * 2 + 1;
			if (!mouseInitializedRef.current) {
				mouseInitializedRef.current = true;
				targetCameraPos.current = { x: x * 50, y: y * 50 };
			}
			mouseRef.current = { x, y };
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("resize", handleResize);

		function handleResize() {
			if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
			const w = containerRef.current.clientWidth;
			const h = containerRef.current.clientHeight;
			cameraRef.current.aspect = w / h;
			cameraRef.current.updateProjectionMatrix();
			rendererRef.current.setSize(w, h);
		}

		function animate(now: number) {
			if (!isVisibleRef.current) {
				frameIdRef.current = 0; 
				return;
			}
			frameIdRef.current = requestAnimationFrame(animate);

            // Delta time calculation
            const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.1); // Cap at 0.1s to prevent jumps after tab switch
            lastTimeRef.current = now;

			const t = now * 0.001;

			// Update scroll rotation early so stars and camera use the same value
			const actualScroll = window.scrollY;
			const rotationThreshold = 800;
			if (actualScroll > rotationThreshold) {
				targetRotationRef.current = (actualScroll - rotationThreshold) * 0.0015;
			} else {
				targetRotationRef.current = 0;
			}
			const rotationLerp = 1 - Math.pow(0.01, deltaTime);
			currentRotationRef.current += (targetRotationRef.current - currentRotationRef.current) * rotationLerp;

			const parallaxLerp = 1 - Math.pow(0.001, deltaTime);
			currentParallaxRef.current += (targetParallaxRef.current - currentParallaxRef.current) * parallaxLerp;
			const scrollY = -currentParallaxRef.current * 1000;

			if (starSystemRef.current) {
				(starSystemRef.current.material as ShaderMaterial).uniforms.time.value = t;
				starSystemRef.current.rotation.y = currentRotationRef.current * 0.8;
				starSystemRef.current.position.y = scrollY;
			}

            if (nebulaRef.current) {
                (nebulaRef.current.material as ShaderMaterial).uniforms.uTime.value = t;
                nebulaRef.current.rotation.z = t * 0.01;
            }

            if (shootingStarsRef.current && Math.random() < 0.006) {
                spawnShootingStarFromPool(shootingStarPoolRef.current);
            }
            updateShootingStarsFromPool(shootingStarPoolRef.current, deltaTime);

			const mouseFactor = 1 - Math.pow(0.0001, deltaTime);
			const mouseX = mouseRef.current.x * 50; 
			const mouseY = mouseRef.current.y * 50;
			targetCameraPos.current.x += (mouseX - targetCameraPos.current.x) * mouseFactor;
			targetCameraPos.current.y += (mouseY - targetCameraPos.current.y) * mouseFactor;

			if (cameraRef.current) {
                const baseOrbit = t * 0.02;
                const radius = 500;
                const orbitalX = Math.sin(currentRotationRef.current + baseOrbit) * radius;
                const orbitalZ = Math.cos(currentRotationRef.current + baseOrbit) * radius;
                
                cameraRef.current.position.x = orbitalX + targetCameraPos.current.x;
                cameraRef.current.position.z = orbitalZ;
				cameraRef.current.position.y = scrollY + targetCameraPos.current.y;
				cameraRef.current.up.set(0, 1, 0);
				cameraRef.current.lookAt(0, scrollY, 0);
			}

			renderer.render(scene, camera);
		}

        lastTimeRef.current = performance.now();
		frameIdRef.current = requestAnimationFrame(animate);

		return () => {
			observer.disconnect();
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("resize", handleResize);
			if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
			if (rendererRef.current) {
				rendererRef.current.dispose();
				containerRef.current?.removeChild(rendererRef.current.domElement);
			}
            starGeo.dispose();
            starMat.dispose();
			nebulaGeo.dispose();
			nebulaMat.dispose();
			cloudTexture.dispose();
            shootingStarPoolRef.current.forEach(line => {
                line.geometry.dispose();
                (line.material as Material).dispose();
            });
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className="canvas-fade-in"
			style={{ position: "fixed", inset: 0, zIndex: -1, background: "#000" }}
		>
			<div style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: "30%",
				background: "linear-gradient(to bottom, transparent, #000)",
				pointerEvents: "none",
			}} />
		</div>
	);
}

function spawnShootingStarFromPool(pool: Line[]) {
    // Find an inactive star
    const star = pool.find(s => !s.userData.active);
    if (!star) return;

    const trailLength = 10 + Math.random() * 20;
    const positions = star.geometry.getAttribute('position') as BufferAttribute;
    const colors = star.geometry.getAttribute('color') as BufferAttribute;

    positions.setXYZ(0, -trailLength, 0, 0);
    positions.setXYZ(1, 0, 0, 0);
    positions.needsUpdate = true;

    colors.setXYZ(0, 0, 0, 0);
    colors.setXYZ(1, 1, 1, 1);
    colors.needsUpdate = true;

    const speed = Math.random() * 15 + 25;
    const angle = -Math.PI / 6 - Math.random() * (Math.PI / 4);
    const velocity = new Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, 0);

    star.position.set((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 1200, (Math.random() - 0.5) * 400 - 100);
    star.userData = { velocity: velocity, life: 1.0, active: true };
    star.rotation.z = angle;
    
    const mat = star.material as LineBasicMaterial;
    mat.opacity = 1.0;
    mat.visible = true;
}

function updateShootingStarsFromPool(pool: Line[], deltaTime: number) {
    const lifeDecay = 1.2 * deltaTime; // Consistent decay
    const speedFactor = 60 * deltaTime; // Normalize speed to 60fps base

    pool.forEach(star => {
        if (!star.userData.active) return;

        const vel = star.userData.velocity as Vector3;
        star.position.x += vel.x * speedFactor;
        star.position.y += vel.y * speedFactor;
        
        star.userData.life -= lifeDecay;
        const mat = star.material as LineBasicMaterial;
        mat.opacity = Math.max(0, star.userData.life);
        
        if (star.userData.life <= 0) {
            star.userData.active = false;
            mat.visible = false;
        }
    });
}
