import React, { useEffect, useRef } from "react";
import {
	Scene,
	PerspectiveCamera,
	WebGLRenderer,
	Points,
	Vector3,
	LineSegments,
	Float32BufferAttribute,
	Color,
	FogExp2,
	BufferGeometry,
	BufferAttribute,
	ShaderMaterial,
	Group,
	LineBasicMaterial,
	AdditiveBlending
} from "three";

export function SpaceContactCanvas(): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement>(null);

	// Refs
	const sceneRef = useRef<Scene | null>(null);
	const cameraRef = useRef<PerspectiveCamera | null>(null);
	const rendererRef = useRef<WebGLRenderer | null>(null);
	const frameIdRef = useRef<number>(0);
	const isVisibleRef = useRef<boolean>(true);

	const starSystemRef = useRef<Points | null>(null);
    const networkRef = useRef<{
        nodes: { pos: Vector3, vel: Vector3, basePos: Vector3 }[],
        edges: LineSegments | null,
        edgeAttribute: Float32BufferAttribute | null,
        colorAttribute: Float32BufferAttribute | null,
    } | null>(null);

	const mouseRef = useRef({ x: 0, y: 0 });
	const targetCameraPos = useRef({ x: 0, y: 0 });
	const targetParallaxRef = useRef(0);
	const currentParallaxRef = useRef(0);

	useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const vh = window.innerHeight;
            // Contact section logic: clamp and map
            targetParallaxRef.current = Math.max(0, Math.min(1.2, (vh - rect.top) / (vh + rect.height)));
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
				if (entry.isIntersecting && !wasVisible && frameIdRef.current === 0) {
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

		// 1. STARFIELD
		const starCount = 3000;
		const starGeo = new BufferGeometry();
		const positions = new Float32Array(starCount * 3);
		const colorsArr = new Float32Array(starCount * 3);
		const sizes = new Float32Array(starCount);
		const phases = new Float32Array(starCount);
		const frequencies = new Float32Array(starCount);
		const extraData = new Float32Array(starCount * 4); // x: glow, y: tw, z: alpha, w: scin

		for (let i = 0; i < starCount; i++) {
			const r = 1000 + Math.random() * 1000;
			const theta = 2 * Math.PI * Math.random();
			const phi = Math.acos(2 * Math.random() - 1);
			positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
			positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
			positions[i * 3 + 2] = r * Math.cos(phi);
            
            const seed = Math.random();
            const colorSeed = Math.random();
            
			sizes[i] = seed < 0.8 ? 0.8 + Math.random() * 1.5 : 2.5 + Math.random() * 2.0;
			phases[i] = Math.random() * Math.PI * 2;
            frequencies[i] = 2.0 + Math.random() * 4.0;
            
            extraData[i * 4] = seed > 0.92 ? 1.0 : 0.0;
            extraData[i * 4 + 1] = Math.random() < 0.2 ? 1.0 : 0.0;
            extraData[i * 4 + 2] = 0.4 + Math.random() * 0.6;
            extraData[i * 4 + 3] = Math.random() < 0.08 ? 0.4 + Math.random() * 0.4 : 0.0;

            let cR=1.0, cG=1.0, cB=1.0;
            if (colorSeed < 0.05) { cR=0.7; cG=0.8; cB=1.0; } // Blue
            else if (colorSeed < 0.12) { cR=1.0; cG=0.9; cB=0.7; } // Yellow
            colorsArr[i * 3] = cR; colorsArr[i * 3 + 1] = cG; colorsArr[i * 3 + 2] = cB;
		}

		starGeo.setAttribute("position", new BufferAttribute(positions, 3));
		starGeo.setAttribute("color", new BufferAttribute(colorsArr, 3));
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
				attribute vec4 extraData; 
				attribute float frequency;
				attribute vec3 color;
				varying float vAlpha;
				varying float vGlow;
				varying vec3 vColor;
				void main() {
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					gl_Position = projectionMatrix * mvPosition;
					gl_PointSize = size * pixelRatio * (600.0 / -mvPosition.z);
					
					// SELECTIVE TWINKLE
					float isTwink = extraData.y;
					float twinkleBase = 0.5 + 0.5 * sin(time * frequency + phase);
					float twinkle = mix(1.0, twinkleBase, isTwink);
					
					vAlpha = extraData.z * (0.15 + 1.35 * twinkle);
					gl_PointSize = gl_PointSize * (0.75 + 0.5 * twinkle);
					gl_PointSize = max(gl_PointSize, 1.0 * pixelRatio);
					vGlow = extraData.x;
					
                    // CHROMATIC SCINTILLATION
                    float scin = extraData.w;
                    float flicker = sin(time * 30.0 + phase * 8.0);
                    vec3 scinColor = color * (1.0 + flicker * 0.15 * scin);
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
					
					float alpha = 1.0 - smoothstep(0.1, 0.45, dist);
					float glow = vGlow * (1.0 - smoothstep(0.0, 0.5, dist)) * 0.6;
					
					gl_FragColor = vec4(vColor, (alpha + glow) * vAlpha);
				}
			`,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});

		const starSystem = new Points(starGeo, starMat);
		starSystem.frustumCulled = false;
		scene.add(starSystem);
		starSystemRef.current = starSystem;

        // 2. STAR NETWORK (Optimized)
        const nodes: { pos: Vector3, vel: Vector3, basePos: Vector3 }[] = [];
        const nodeCount = 180; // DRAMATICALLY REDUCED from 3000
        for (let i = 0; i < nodeCount; i++) {
             // Spread nodes in a sphere
             const r = Math.random() * 800;
             const theta = Math.random() * Math.PI * 2;
             const phi = Math.acos(2 * Math.random() - 1);
             const pos = new Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
             nodes.push({ 
                pos: pos.clone(), 
                vel: new Vector3(0, 0, 0),
                basePos: pos.clone()
            });
        }

        const edgeGeo = new BufferGeometry();
        const edgeMat = new LineBasicMaterial({ 
            vertexColors: true,
            transparent: true, 
            blending: AdditiveBlending,
            linewidth: 1,
        });
        const edges = new LineSegments(edgeGeo, edgeMat);
        
        const maxConnections = 600; // Sufficient for 180 nodes
        const posBuffer = new Float32BufferAttribute(new Float32Array(maxConnections * 3 * 2), 3);
        const colorBuffer = new Float32BufferAttribute(new Float32Array(maxConnections * 3 * 2), 3);
        
        edgeGeo.setAttribute('position', posBuffer);
        edgeGeo.setAttribute('color', colorBuffer);
        scene.add(edges);

        networkRef.current = { 
            nodes, 
            edges, 
            edgeAttribute: posBuffer,
            colorAttribute: colorBuffer 
        };

		const handleMouseMove = (e: MouseEvent) => {
			const x = (e.clientX / window.innerWidth) * 2 - 1;
			const y = -(e.clientY / window.innerHeight) * 2 + 1;
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

        function writeLine(n1: any, n2: any, index: number, posArr: Float32Array, colArr: Float32Array, mPos: Vector3, distSq: number) {
            const i3 = index * 6;
            posArr[i3] = n1.pos.x; posArr[i3+1] = n1.pos.y; posArr[i3+2] = n1.pos.z;
            posArr[i3+3] = n2.pos.x; posArr[i3+4] = n2.pos.y; posArr[i3+5] = n2.pos.z;
            
            const d1Sq = n1.pos.distanceToSquared(mPos);
            const d2Sq = n2.pos.distanceToSquared(mPos);
            const avgDSq = (d1Sq + d2Sq) / 2;
            
            // Cursor influence based on squared distance
            const cursorInfluence = Math.max(0, 1.0 - avgDSq / (500 * 500));
            // Proximity opacity based on squared distance
            const proximityFactor = 1.0 - distSq / (280 * 280);
            
            const intensity = (0.003 + cursorInfluence * 0.3) * proximityFactor;
            
            const type = index % 3;
            let r=0.5, g=0.5, b=0.5;
            if (type === 1) { r=0.2; g=0.5; b=1.0; } 
            else if (type === 2) { r=1.0; g=0.8; b=0.3; } 
            
            colArr[i3] = r * intensity; colArr[i3+1] = g * intensity; colArr[i3+2] = b * intensity;
            colArr[i3+3] = r * intensity; colArr[i3+4] = g * intensity; colArr[i3+5] = b * intensity;
        }

		function animate(time: number) {
			if (!isVisibleRef.current) {
				frameIdRef.current = 0;
				return;
			}
			frameIdRef.current = requestAnimationFrame(animate);
			const t = time * 0.001;

			if (starSystemRef.current) {
				(starSystemRef.current.material as ShaderMaterial).uniforms.time.value = t;
				starSystemRef.current.rotation.y = t * 0.02;
			}

            if (networkRef.current) {
                const { nodes, edges, edgeAttribute, colorAttribute } = networkRef.current;
                const maxDistSq = 280 * 280;
                const mouseInfluenceDistSq = 450 * 450;
                const mousePos = new Vector3(
                    mouseRef.current.x * 600, 
                    mouseRef.current.y * 400 - currentParallaxRef.current * 1000, 
                    0
                );

                nodes.forEach(node => {
                    const springStrength = 0.012;
                    const friction = 0.92; // Slightly more friction for control
                    const mouseAttraction = 8.0; // MAXIMUM Gravitational Pull
                    
                    const springForceX = (node.basePos.x - node.pos.x) * springStrength;
                    const springForceY = (node.basePos.y - node.pos.y) * springStrength;
                    const springForceZ = (node.basePos.z - node.pos.z) * springStrength;
                    
                    node.vel.x += springForceX;
                    node.vel.y += springForceY;
                    node.vel.z += springForceZ;

                    const dx = mousePos.x - node.pos.x;
                    const dy = mousePos.y - node.pos.y;
                    const dz = mousePos.z - node.pos.z;
                    const distSq = dx*dx + dy*dy + dz*dz;
                    
                    if (distSq < mouseInfluenceDistSq) {
                        const dist = Math.sqrt(distSq);
                        const strength = (1 - dist / 450) * mouseAttraction;
                        node.vel.x += (dx / dist) * strength;
                        node.vel.y += (dy / dist) * strength;
                        node.vel.z += (dz / dist) * strength;
                    }
                    node.vel.x *= friction;
                    node.vel.y *= friction;
                    node.vel.z *= friction;
                    node.pos.x += node.vel.x;
                    node.pos.y += node.vel.y;
                    node.pos.z += node.vel.z;
                });

                if (edges && edgeAttribute && colorAttribute) {
                    const positionsArr = edgeAttribute.array as Float32Array;
                    const colorsArrAttribute = colorAttribute.array as Float32Array;
                    let lineIndex = 0;
                    
                    // Proximity-based web with short range
                    for (let i = 0; i < nodes.length; i++) {
                        const node = nodes[i];
                        for (let j = i + 1; j < nodes.length; j++) {
                            const other = nodes[j];
                            const dx = node.pos.x - other.pos.x;
                            const dy = node.pos.y - other.pos.y;
                            const dz = node.pos.z - other.pos.z;
                            const dSq = dx*dx + dy*dy + dz*dz;
                            
                            if (dSq < maxDistSq) {
                                if (lineIndex < maxConnections - 1) {
                                    writeLine(node, other, lineIndex++, positionsArr, colorsArrAttribute, mousePos, dSq);
                                } else {
                                    break; // Max connections reached
                                }
                            }
                        }
                        if (lineIndex >= maxConnections - 1) break;
                    }
                    edges.geometry.setDrawRange(0, lineIndex * 2);
                    edgeAttribute.needsUpdate = true;
                    colorAttribute.needsUpdate = true;
                }
            }

			const parallaxSpeed = 0.12;
			currentParallaxRef.current += (targetParallaxRef.current - currentParallaxRef.current) * parallaxSpeed;

			const mouseX = mouseRef.current.x * 50; 
			const mouseY = mouseRef.current.y * 50;
			targetCameraPos.current.x += (mouseX - targetCameraPos.current.x) * 0.05;
			targetCameraPos.current.y += (mouseY - targetCameraPos.current.y) * 0.05;

			if (cameraRef.current) {
				cameraRef.current.position.x = targetCameraPos.current.x;
				const scrollY = -currentParallaxRef.current * 1000;
				cameraRef.current.position.y = scrollY + targetCameraPos.current.y;
				cameraRef.current.lookAt(0, scrollY, 0); 
			}

			renderer.render(scene, camera);
		}

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
            edgeGeo.dispose();
            edgeMat.dispose();
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className="canvas-fade-in"
			style={{ position: "absolute", inset: 0, zIndex: -1, background: "#000" }}
		/>
	);
}
