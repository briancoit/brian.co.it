declare function postMessage(message: unknown, transfer: Transferable[]): void;

function gaussRand() {
  return Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function generateStars(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const freqs = new Float32Array(count);
  const extras = new Float32Array(count * 4);

  // Generate random cluster centers within the star shell
  const clusterCount = 8 + Math.floor(Math.random() * 8);
  const clusters: { x: number; y: number; z: number; radius: number; tint: number }[] = [];
  for (let c = 0; c < clusterCount; c++) {
    const r = 1000 + Math.random() * 1000;
    const theta = 2 * Math.PI * Math.random();
    const cosPhi = 1.0 - 2.0 * Math.random() ** 1.8;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    clusters.push({
      x: r * sinPhi * Math.cos(theta),
      y: r * cosPhi,
      z: r * sinPhi * Math.sin(theta),
      radius: 15 + Math.random() * 30,
      tint: Math.random(),
    });
  }

  // ~15% of stars go into clusters
  const clusterStarCount = Math.floor(count * 0.15);
  const fieldStarCount = count - clusterStarCount;

  for (let i = 0; i < count; i++) {
    let px: number;
    let py: number;
    let pz: number;
    let isClusterStar = false;

    let clusterDist = 0;
    let clusterRef: (typeof clusters)[0] | null = null;

    if (i >= fieldStarCount) {
      // Cluster star — Gaussian distribution around a random cluster center
      clusterRef = clusters[Math.floor(Math.random() * clusters.length)];
      const ox = gaussRand() * clusterRef.radius;
      const oy = gaussRand() * clusterRef.radius;
      const oz = gaussRand() * clusterRef.radius;
      px = clusterRef.x + ox;
      py = clusterRef.y + oy;
      pz = clusterRef.z + oz;
      clusterDist = Math.sqrt(ox * ox + oy * oy + oz * oz) / clusterRef.radius;
      isClusterStar = true;
    } else {
      // Field star — uniform spherical shell
      const r = 1000 + Math.random() * 1000;
      const theta = 2 * Math.PI * Math.random();
      const cosPhi = 1.0 - 2.0 * Math.random() ** 1.8;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      px = r * sinPhi * Math.cos(theta);
      py = r * cosPhi;
      pz = r * sinPhi * Math.sin(theta);
    }

    positions[i * 3] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    const seed = Math.random();
    const colorSeed = Math.random();
    const coreFade = Math.max(0, 1 - clusterDist * 0.7);
    sizes[i] = isClusterStar
      ? (0.4 + Math.random() * 0.5) * (0.6 + 0.4 * coreFade)
      : seed < 0.8
        ? 0.8 + Math.random() * 1.2
        : 2.0 + Math.random() * 1.5;
    phases[i] = Math.random() * Math.PI * 2;
    freqs[i] = 0.5 + Math.random() * 1.0;
    extras[i * 4] = seed > 0.94 ? 1.0 : 0.0;
    extras[i * 4 + 1] = Math.random() < 0.2 ? 1.0 : 0.0;
    extras[i * 4 + 2] = isClusterStar
      ? (0.2 + Math.random() * 0.25) * (0.5 + 0.5 * coreFade)
      : 0.4 + Math.random() * 0.6;
    extras[i * 4 + 3] = Math.random() < 0.08 ? 0.2 + Math.random() * 0.2 : 0.0;

    let cR = 1.0;
    let cG = 1.0;
    let cB = 1.0;
    if (isClusterStar && clusterRef) {
      if (clusterRef.tint < 0.33) {
        cR = 0.75 + Math.random() * 0.1;
        cG = 0.85 + Math.random() * 0.1;
        cB = 1.0;
      } else if (clusterRef.tint < 0.66) {
        cR = 1.0;
        cG = 0.92 + Math.random() * 0.08;
        cB = 0.75 + Math.random() * 0.1;
      }
    } else if (colorSeed < 0.04) {
      cR = 0.7;
      cG = 0.8;
      cB = 1.0;
    } else if (colorSeed < 0.08) {
      cR = 1.0;
      cG = 0.9;
      cB = 0.7;
    }
    colors[i * 3] = cR;
    colors[i * 3 + 1] = cG;
    colors[i * 3 + 2] = cB;
  }

  return { positions, colors, sizes, phases, freqs, extras };
}

function generateCloudTexture(): ImageBitmap {
  const size = 512;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;

  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
  grad.addColorStop(0.8, "rgba(255, 255, 255, 0.05)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 30;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.transferToImageBitmap();
}

self.onmessage = () => {
  const stars = generateStars(50000);
  const cloudBitmap = generateCloudTexture();

  postMessage(
    {
      positions: stars.positions,
      colors: stars.colors,
      sizes: stars.sizes,
      phases: stars.phases,
      freqs: stars.freqs,
      extras: stars.extras,
      cloudBitmap,
    },
    [
      stars.positions.buffer,
      stars.colors.buffer,
      stars.sizes.buffer,
      stars.phases.buffer,
      stars.freqs.buffer,
      stars.extras.buffer,
      cloudBitmap,
    ],
  );
};
