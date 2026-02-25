declare function postMessage(message: unknown, transfer: Transferable[]): void;

function gaussRand() {
  return (
    Math.sqrt(-2 * Math.log(Math.random())) *
    Math.cos(2 * Math.PI * Math.random())
  );
}

function generateStarBatch(
  offset: number,
  count: number,
  totalCount: number,
  clusters: { x: number; y: number; z: number; radius: number; tint: number; rotX: number; rotY: number; rotZ: number }[],
) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const freqs = new Float32Array(count);
  const extras = new Float32Array(count * 4);

  const clusterStarCount = Math.floor(totalCount * 0.08); // 8% of stars in galaxies
  const fieldStarCount = totalCount - clusterStarCount;

  for (let j = 0; j < count; j++) {
    const i = offset + j;
    let px: number;
    let py: number;
    let pz: number;
    let isClusterStar = false;

    let clusterDist = 0;
    let clusterRef: (typeof clusters)[0] | null = null;

    if (i >= fieldStarCount) {
      clusterRef = clusters[Math.floor(Math.random() * clusters.length)];
      // Generate flat disc shape
      const ox = gaussRand() * clusterRef.radius;
      const oy = gaussRand() * (clusterRef.radius * 0.15); // Flatter discs
      const oz = gaussRand() * clusterRef.radius;

      // Apply random 3D rotation using Euler angles
      const sx = Math.sin(clusterRef.rotX), cx = Math.cos(clusterRef.rotX);
      const sy = Math.sin(clusterRef.rotY), cy = Math.cos(clusterRef.rotY);
      const sz = Math.sin(clusterRef.rotZ), cz = Math.cos(clusterRef.rotZ);

      // Rotate around Z
      const x1 = ox * cz - oy * sz;
      const y1 = ox * sz + oy * cz;
      const z1 = oz;

      // Rotate around Y
      const x2 = x1 * cy + z1 * sy;
      const y2 = y1;
      const z2 = -x1 * sy + z1 * cy;

      // Rotate around X
      const x3 = x2;
      const y3 = y2 * cx - z2 * sx;
      const z3 = y2 * sx + z2 * cx;

      px = clusterRef.x + x3;
      py = clusterRef.y + y3;
      pz = clusterRef.z + z3;

      clusterDist = Math.sqrt(ox * ox + oy * oy + oz * oz) / clusterRef.radius;
      isClusterStar = true;
    } else {
      // Background field stars: pack them much tighter for high density, but safely outside near-camera (r>1500)
      const r = 1500 + Math.random() * 2000;
      const theta = 2 * Math.PI * Math.random();
      px = r * Math.cos(theta);
      py = (Math.random() - 0.5) * 4000; // Flawless wrap bounds
      pz = r * Math.sin(theta);
    }

    positions[j * 3] = px;
    positions[j * 3 + 1] = py;
    positions[j * 3 + 2] = pz;

    const seed = Math.random();
    const colorSeed = Math.random();
    const coreFade = Math.max(0, 1 - clusterDist * 0.5); // Fade much slower from core
    
    sizes[j] = isClusterStar
      ? seed < 0.8
        ? (1.0 + Math.random() * 1.5) * (0.6 + 0.4 * coreFade)
        : (2.0 + Math.random() * 2.0) * (0.6 + 0.4 * coreFade)
      : seed < 0.8
        ? 0.8 + Math.random() * 1.2 // Boosted normal star size
        : 1.8 + Math.random() * 1.5;
      
    phases[j] = Math.random() * Math.PI * 2;
    freqs[j] = 0.5 + Math.random() * 1.0;

    extras[j * 4] = seed > 0.94 ? 1.0 : 0.0;
    extras[j * 4 + 1] = Math.random() < 0.2 ? 1.0 : 0.0;
    extras[j * 4 + 2] = (0.5 + Math.random() * 0.5) * (0.7 + 0.3 * coreFade); // Brighter glow
    extras[j * 4 + 3] = Math.random() < 0.08 ? 0.2 + Math.random() * 0.2 : 0.0;

    let cR = 1.0;
    let cG = 1.0;
    let cB = 1.0;

    // Normal field star colors (unchanged)
    if (colorSeed < 0.04) {
      cR = 0.7; cG = 0.8; cB = 1.0;
    } else if (colorSeed < 0.08) {
      cR = 1.0; cG = 0.9; cB = 0.7;
    }

    if (isClusterStar) {
      // Darken galaxies slightly to sit deeper in the background
      cR *= 0.7;
      cG *= 0.7;
      cB *= 0.7;
    }

    colors[j * 3] = cR;
    colors[j * 3 + 1] = cG;
    colors[j * 3 + 2] = cB;
  }

  return { positions, colors, sizes, phases, freqs, extras };
}

self.onmessage = () => {
  const totalCount = 100000;
  const batchSize = 10000;

  // Generate clusters once, shared across batches
  const clusterCount = 10 + Math.floor(Math.random() * 10); // 10 to 20 distinct galaxies
  const clusters: { x: number; y: number; z: number; radius: number; tint: number; rotX: number; rotY: number; rotZ: number }[] = [];
  for (let c = 0; c < clusterCount; c++) {
    // Keep galaxies outside the camera rotation radius (1200)
    const r = 2500 + Math.random() * 2500;
    const theta = 2 * Math.PI * Math.random();
    clusters.push({
      x: r * Math.cos(theta),
      y: (Math.random() - 0.5) * 4000, 
      z: r * Math.sin(theta),
      radius: 50 + Math.random() * 80, // Small and distant
      tint: Math.random(),
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI * 2,
    });
  }

  // Stream star data in batches
  for (let offset = 0; offset < totalCount; offset += batchSize) {
    const count = Math.min(batchSize, totalCount - offset);
    const batch = generateStarBatch(offset, count, totalCount, clusters);
    postMessage(
      {
        type: "stars",
        offset,
        count,
        positions: batch.positions,
        colors: batch.colors,
        sizes: batch.sizes,
        phases: batch.phases,
        freqs: batch.freqs,
        extras: batch.extras,
      },
      [
        batch.positions.buffer,
        batch.colors.buffer,
        batch.sizes.buffer,
        batch.phases.buffer,
        batch.freqs.buffer,
        batch.extras.buffer,
      ],
    );
  }
};
