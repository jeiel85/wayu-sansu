import * as THREE from 'three';

export const WATER_LEVEL = 0.0;

export class Turntable {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.shape = 'round'; // 'round' | 'square'
    this.sizeKey = 'medium'; // 'small' | 'medium' | 'large'
    this.radius = 32;
    this.gridRes = 104;
    this.season = 'summer';
    this.waterEnabled = true;
    this.inkContours = true;

    this.heights = new Float32Array((this.gridRes + 1) * (this.gridRes + 1));
    this.rockiness = new Float32Array((this.gridRes + 1) * (this.gridRes + 1));
    this.roadMask = new Float32Array((this.gridRes + 1) * (this.gridRes + 1)); // 0=none, 1=dirt, 2=stone, 3=royal
    this.paddyMask = new Float32Array((this.gridRes + 1) * (this.gridRes + 1));

    this.terrainMesh = null;
    this.skirtMesh = null;
    this.waterMesh = null;
    this.plinthGroup = null;
    this.brushRing = null;

    this.buildMeshes();
    this.createBrushCursor();
  }

  getSizeRadius(key) {
    if (key === 'small') return 24;
    if (key === 'large') return 42;
    return 32;
  }

  setConfig({ shape, sizeKey, season, waterEnabled, inkContours }) {
    let rebuild = false;
    if (shape && shape !== this.shape) {
      this.shape = shape;
      rebuild = true;
    }
    if (sizeKey && sizeKey !== this.sizeKey) {
      this.sizeKey = sizeKey;
      this.radius = this.getSizeRadius(sizeKey);
      rebuild = true;
    }
    if (season) this.season = season;
    if (typeof waterEnabled === 'boolean') {
      this.waterEnabled = waterEnabled;
      if (this.waterMesh) this.waterMesh.visible = waterEnabled;
    }
    if (typeof inkContours === 'boolean') {
      this.inkContours = inkContours;
    }

    if (rebuild) {
      this.buildMeshes();
    } else {
      this.updateTerrainGeometry();
    }
  }

  isInsidePlot(x, z, margin = 0) {
    const lim = this.radius - margin;
    if (this.shape === 'round') {
      return (x * x + z * z) <= lim * lim;
    } else {
      return Math.abs(x) <= lim && Math.abs(z) <= lim;
    }
  }

  clampToPlot(x, z, margin = 1.2) {
    const lim = this.radius - margin;
    if (this.shape === 'round') {
      const d = Math.hypot(x, z);
      if (d > lim && d > 0.0001) {
        return { x: (x / d) * lim, z: (z / d) * lim };
      }
      return { x, z };
    } else {
      return {
        x: Math.max(-lim, Math.min(lim, x)),
        z: Math.max(-lim, Math.min(lim, z))
      };
    }
  }

  buildMeshes() {
    // Clear existing
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }

    const R = this.radius;
    const N = this.gridRes;

    // 1. Terrain Geometry
    const geom = new THREE.BufferGeometry();
    const numVerts = (N + 1) * (N + 1);
    const positions = new Float32Array(numVerts * 3);
    const colors = new Float32Array(numVerts * 3);
    const uvs = new Float32Array(numVerts * 2);

    for (let iz = 0; iz <= N; iz++) {
      for (let ix = 0; ix <= N; ix++) {
        const idx = iz * (N + 1) + ix;
        const u = ix / N;
        const v = iz / N;
        let x = (u * 2 - 1) * R;
        let z = (v * 2 - 1) * R;

        // If round, map square grid smoothly or clamp outside vertices to circle rim
        if (this.shape === 'round') {
          const d = Math.hypot(x, z);
          if (d > R) {
            x = (x / d) * R;
            z = (z / d) * R;
          }
        }

        positions[idx * 3 + 0] = x;
        positions[idx * 3 + 1] = this.heights[idx] || 0;
        positions[idx * 3 + 2] = z;

        uvs[idx * 2 + 0] = u;
        uvs[idx * 2 + 1] = v;
      }
    }

    const indices = [];
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const a = iz * (N + 1) + ix;
        const b = a + 1;
        const c = (iz + 1) * (N + 1) + ix;
        const d = c + 1;

        if (this.shape === 'round') {
          const ax = positions[a * 3], az = positions[a * 3 + 2];
          const dx = positions[d * 3], dz = positions[d * 3 + 2];
          if (Math.hypot(ax, az) >= R * 0.998 && Math.hypot(dx, dz) >= R * 0.998) {
            // still include if not degenerate
          }
        }
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
      flatShading: false
    });

    this.terrainMesh = new THREE.Mesh(geom, terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = true;
    this.terrainMesh.name = 'terrain';
    this.group.add(this.terrainMesh);

    // 2. Earth Cross-section Skirt (지층 단면)
    this.buildSkirtMesh();

    // 3. Water Surface Mesh (강·연못 수면)
    let waterGeom;
    if (this.shape === 'round') {
      waterGeom = new THREE.CircleGeometry(R - 0.15, 96);
      waterGeom.rotateX(-Math.PI / 2);
    } else {
      waterGeom = new THREE.PlaneGeometry((R - 0.15) * 2, (R - 0.15) * 2, 32, 32);
      waterGeom.rotateX(-Math.PI / 2);
    }

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x5c8b91,
      roughness: 0.22,
      metalness: 0.15,
      transparent: true,
      opacity: 0.78
    });
    this.waterMesh = new THREE.Mesh(waterGeom, waterMat);
    this.waterMesh.position.y = WATER_LEVEL;
    this.waterMesh.receiveShadow = true;
    this.waterMesh.visible = this.waterEnabled;
    this.group.add(this.waterMesh);

    // 4. Wooden Carved Turntable Stand (전통 목조 좌대)
    this.buildPlinth();

    if (this.brushRing) {
      this.group.add(this.brushRing);
    }

    this.updateTerrainGeometry();
  }

  buildSkirtMesh() {
    if (this.skirtMesh) {
      this.group.remove(this.skirtMesh);
    }
    const N = this.gridRes;
    const baseDepth = -2.2;
    const borderIndices = [];

    // Collect perimeter vertex indices in order
    for (let ix = 0; ix <= N; ix++) borderIndices.push(ix);
    for (let iz = 1; iz <= N; iz++) borderIndices.push(iz * (N + 1) + N);
    for (let ix = N - 1; ix >= 0; ix--) borderIndices.push(N * (N + 1) + ix);
    for (let iz = N - 1; iz >= 0; iz--) borderIndices.push(iz * (N + 1));

    const count = borderIndices.length;
    const skirtPos = new Float32Array(count * 2 * 3);
    const skirtIndices = [];

    for (let i = 0; i < count - 1; i++) {
      const topA = i * 2;
      const botA = i * 2 + 1;
      const topB = (i + 1) * 2;
      const botB = (i + 1) * 2 + 1;
      skirtIndices.push(topA, botA, topB);
      skirtIndices.push(topB, botA, botB);
    }

    const skirtGeom = new THREE.BufferGeometry();
    skirtGeom.setAttribute('position', new THREE.BufferAttribute(skirtPos, 3));
    skirtGeom.setIndex(skirtIndices);
    skirtGeom.userData = { borderIndices, baseDepth };

    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x6b533b,
      roughness: 0.92,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.skirtMesh = new THREE.Mesh(skirtGeom, skirtMat);
    this.skirtMesh.castShadow = true;
    this.skirtMesh.receiveShadow = true;
    this.group.add(this.skirtMesh);
  }

  buildPlinth() {
    this.plinthGroup = new THREE.Group();
    const R = this.radius;

    const woodDarkMat = new THREE.MeshStandardMaterial({
      color: 0x3b2618,
      roughness: 0.65,
      metalness: 0.08
    });
    const woodMidMat = new THREE.MeshStandardMaterial({
      color: 0x523622,
      roughness: 0.7,
      metalness: 0.06
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb8964c,
      roughness: 0.35,
      metalness: 0.65
    });

    if (this.shape === 'round') {
      // Upper wood rim
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.1, R + 1.4, 1.5, 96), woodMidMat);
      rim.position.y = -2.1;
      rim.receiveShadow = true;
      rim.castShadow = true;
      this.plinthGroup.add(rim);

      // Brass inlaid band (전통 유기/황동 띠)
      const brassRing = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.46, R + 1.46, 0.28, 96), brassMat);
      brassRing.position.y = -2.1;
      this.plinthGroup.add(brassRing);

      // Stepped carved pedestal base
      const step2 = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R - 1.2, 1.4, 96), woodDarkMat);
      step2.position.y = -3.4;
      step2.castShadow = true;
      this.plinthGroup.add(step2);

      const foot = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.5, R + 0.8, 0.8, 96), woodMidMat);
      foot.position.y = -4.3;
      foot.castShadow = true;
      this.plinthGroup.add(foot);
    } else {
      const S = (R + 1.1) * 2;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(S, 1.5, S), woodMidMat);
      rim.position.y = -2.1;
      rim.receiveShadow = true;
      rim.castShadow = true;
      this.plinthGroup.add(rim);

      const brassBand = new THREE.Mesh(new THREE.BoxGeometry(S + 0.15, 0.28, S + 0.15), brassMat);
      brassBand.position.y = -2.1;
      this.plinthGroup.add(brassBand);

      const step2 = new THREE.Mesh(new THREE.BoxGeometry(S - 2.2, 1.4, S - 2.2), woodDarkMat);
      step2.position.y = -3.4;
      step2.castShadow = true;
      this.plinthGroup.add(step2);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(S - 0.8, 0.8, S - 0.8), woodMidMat);
      foot.position.y = -4.3;
      foot.castShadow = true;
      this.plinthGroup.add(foot);
    }

    // Soft ink shadow plane on the Hanji desk surface
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(R * 3.2, R * 3.2),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -4.71;
    shadowPlane.receiveShadow = true;
    this.plinthGroup.add(shadowPlane);

    this.group.add(this.plinthGroup);
  }

  createBrushCursor() {
    const geom = new THREE.RingGeometry(0.92, 1.04, 48);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xa62c22,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthTest: false
    });
    this.brushRing = new THREE.Mesh(geom, mat);
    this.brushRing.visible = false;
    this.brushRing.renderOrder = 999;
    this.group.add(this.brushRing);
  }

  updateBrushCursor(point, radius, visible = true) {
    if (!this.brushRing) return;
    this.brushRing.visible = visible;
    if (visible && point) {
      this.brushRing.position.set(point.x, Math.max(WATER_LEVEL, point.y) + 0.12, point.z);
      this.brushRing.scale.set(radius, 1, radius);
    }
  }

  // Bilinear height lookup at world (x, z)
  getHeightAt(x, z) {
    const R = this.radius;
    const N = this.gridRes;
    const u = Math.max(0, Math.min(1, (x / R + 1) * 0.5));
    const v = Math.max(0, Math.min(1, (z / R + 1) * 0.5));
    const gx = u * N;
    const gz = v * N;
    const ix = Math.min(N - 1, Math.floor(gx));
    const iz = Math.min(N - 1, Math.floor(gz));
    const fx = gx - ix;
    const fz = gz - iz;

    const h00 = this.heights[iz * (N + 1) + ix];
    const h10 = this.heights[iz * (N + 1) + ix + 1];
    const h01 = this.heights[(iz + 1) * (N + 1) + ix];
    const h11 = this.heights[(iz + 1) * (N + 1) + ix + 1];

    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    return h0 * (1 - fz) + h1 * fz;
  }

  getNormalAt(x, z) {
    const eps = 0.6;
    const hL = this.getHeightAt(x - eps, z);
    const hR = this.getHeightAt(x + eps, z);
    const hD = this.getHeightAt(x, z - eps);
    const hU = this.getHeightAt(x, z + eps);
    const v = new THREE.Vector3(hL - hR, 2 * eps, hD - hU).normalize();
    return v;
  }

  getSlopeAt(x, z) {
    const n = this.getNormalAt(x, z);
    return 1 - n.y;
  }

  paintRoadMask(x, z, radius, roadTypeVal) {
    const R = this.radius;
    const N = this.gridRes;
    for (let iz = 0; iz <= N; iz++) {
      for (let ix = 0; ix <= N; ix++) {
        const idx = iz * (N + 1) + ix;
        const vx = ((ix / N) * 2 - 1) * R;
        const vz = ((iz / N) * 2 - 1) * R;
        const d = Math.hypot(vx - x, vz - z);
        if (d <= radius) {
          this.roadMask[idx] = roadTypeVal;
        }
      }
    }
  }

  paintPaddyMask(polygon, enable = 1) {
    // Point-in-polygon check for rice paddy water sheen & bund lines
    const R = this.radius;
    const N = this.gridRes;
    for (let iz = 0; iz <= N; iz++) {
      for (let ix = 0; ix <= N; ix++) {
        const idx = iz * (N + 1) + ix;
        const vx = ((ix / N) * 2 - 1) * R;
        const vz = ((iz / N) * 2 - 1) * R;
        if (this.pointInPoly(vx, vz, polygon)) {
          this.paddyMask[idx] = enable;
          // Slightly terrace the paddy height so rice paddies look like stepped levels (다랑논)
          const h = this.heights[idx];
          if (h > WATER_LEVEL + 0.15) {
            this.heights[idx] = Math.round(h * 2.2) / 2.2;
          }
        }
      }
    }
    this.updateTerrainGeometry();
  }

  pointInPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, zi = poly[i].z;
      const xj = poly[j].x, zj = poly[j].z;
      const intersect = ((zi > z) !== (zj > z)) &&
        (x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Sculpt terrain with brush
  sculpt(centerX, centerZ, mode, radius, strength) {
    const R = this.radius;
    const N = this.gridRes;
    const targetFlatH = this.getHeightAt(centerX, centerZ);

    const tempHeights = new Float32Array(this.heights);

    for (let iz = 0; iz <= N; iz++) {
      for (let ix = 0; ix <= N; ix++) {
        const idx = iz * (N + 1) + ix;
        const vx = ((ix / N) * 2 - 1) * R;
        const vz = ((iz / N) * 2 - 1) * R;

        const dist = Math.hypot(vx - centerX, vz - centerZ);
        if (dist > radius) continue;

        // Smooth falloff
        const t = 1 - dist / radius;
        const falloff = t * t * (3 - 2 * t);
        let h = this.heights[idx];

        if (mode === 'raise') {
          h += 0.26 * strength * falloff;
        } else if (mode === 'lower') {
          h -= 0.26 * strength * falloff;
        } else if (mode === 'terrace') {
          const step = 0.85;
          const terraced = Math.round(h / step) * step;
          h = h + (terraced - h) * (0.45 * strength * falloff);
        } else if (mode === 'flatten') {
          h = h + (targetFlatH - h) * (0.45 * strength * falloff);
        } else if (mode === 'rock') {
          const ridge = Math.abs(Math.sin(vx * 0.7 + vz * 0.5) * Math.cos(vx * 0.4 - vz * 0.8));
          h += (0.18 + ridge * 0.35) * strength * falloff;
          this.rockiness[idx] = Math.min(1, this.rockiness[idx] + 0.35 * falloff);
        } else if (mode === 'smooth') {
          let sum = 0, cnt = 0;
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = ix + dx, nz = iz + dz;
              if (nx >= 0 && nx <= N && nz >= 0 && nz <= N) {
                sum += tempHeights[nz * (N + 1) + nx];
                cnt++;
              }
            }
          }
          const avg = sum / cnt;
          h = h + (avg - h) * (0.55 * strength * falloff);
        }

        // Clamp rim slightly so it sits nicely on the turntable
        const edgeDist = this.shape === 'round'
          ? Math.hypot(vx, vz) / R
          : Math.max(Math.abs(vx), Math.abs(vz)) / R;

        if (edgeDist > 0.94) {
          h = Math.max(-1.6, Math.min(8.5, h));
        } else {
          h = Math.max(-1.8, Math.min(14.0, h));
        }

        this.heights[idx] = h;
      }
    }

    this.updateTerrainGeometry();
  }

  // Update vertex positions, normals, skirt, and Sansuhwa watercolor vertex colors
  updateTerrainGeometry() {
    if (!this.terrainMesh) return;
    const geom = this.terrainMesh.geometry;
    const posAttr = geom.getAttribute('position');
    const colAttr = geom.getAttribute('color');
    const N = this.gridRes;
    const R = this.radius;

    for (let i = 0; i < this.heights.length; i++) {
      posAttr.setY(i, this.heights[i]);
    }
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();

    const normAttr = geom.getAttribute('normal');

    // Seasonal Palette in Sansuhwa (수묵담채화 사계절 배색)
    const palettes = {
      spring: {
        sand: new THREE.Color(0xcab996),
        grassLow: new THREE.Color(0x8fa868),
        grassMid: new THREE.Color(0x749154),
        grassHigh: new THREE.Color(0x5c7846),
        rock: new THREE.Color(0x6e6a63),
        peak: new THREE.Color(0x586259),
        paddy: new THREE.Color(0x789c78),
        waterTint: 0x62959c
      },
      summer: {
        sand: new THREE.Color(0xc5b28c),
        grassLow: new THREE.Color(0x769452),
        grassMid: new THREE.Color(0x5b7c42),
        grassHigh: new THREE.Color(0x436236),
        rock: new THREE.Color(0x66635b),
        peak: new THREE.Color(0x3a5239),
        paddy: new THREE.Color(0x689458),
        waterTint: 0x4f838b
      },
      autumn: {
        sand: new THREE.Color(0xcbb386),
        grassLow: new THREE.Color(0xb89650),
        grassMid: new THREE.Color(0x9e743c),
        grassHigh: new THREE.Color(0x875432),
        rock: new THREE.Color(0x6b6258),
        peak: new THREE.Color(0x704932),
        paddy: new THREE.Color(0xd1a74a),
        waterTint: 0x567d87
      },
      winter: {
        sand: new THREE.Color(0xd2cab8),
        grassLow: new THREE.Color(0xe6e4dc),
        grassMid: new THREE.Color(0xefeee8),
        grassHigh: new THREE.Color(0xf7f6f2),
        rock: new THREE.Color(0x707274),
        peak: new THREE.Color(0xffffff),
        paddy: new THREE.Color(0xd8dfe0),
        waterTint: 0x6f909c
      }
    };

    const pal = palettes[this.season] || palettes.summer;
    if (this.waterMesh) {
      this.waterMesh.material.color.setHex(pal.waterTint);
    }

    const tmpColor = new THREE.Color();
    const inkColor = new THREE.Color(0x281e16);
    const dirtRoadCol = new THREE.Color(0xb8996c);
    const stoneRoadCol = new THREE.Color(0x8d877c);
    const royalRoadCol = new THREE.Color(0xc7b28b);

    for (let iz = 0; iz <= N; iz++) {
      for (let ix = 0; ix <= N; ix++) {
        const idx = iz * (N + 1) + ix;
        const h = this.heights[idx];
        const ny = normAttr.getY(idx);
        const slope = 1.0 - ny;
        const rock = this.rockiness[idx];
        const vx = posAttr.getX(idx);
        const vz = posAttr.getZ(idx);

        // Paper grain noise
        const grain = (Math.sin(vx * 1.9 + vz * 1.3) * Math.cos(vx * 1.1 - vz * 2.1)) * 0.03;

        if (h < WATER_LEVEL + 0.22) {
          tmpColor.copy(pal.sand);
          if (h < WATER_LEVEL) {
            tmpColor.lerp(new THREE.Color(0x4b6e75), Math.min(0.65, -h * 0.45));
          }
        } else if (h < 2.2) {
          const t = (h - 0.22) / 1.98;
          tmpColor.copy(pal.grassLow).lerp(pal.grassMid, t);
        } else if (h < 5.5) {
          const t = (h - 2.2) / 3.3;
          tmpColor.copy(pal.grassMid).lerp(pal.grassHigh, t);
        } else {
          const t = Math.min(1, (h - 5.5) / 4.5);
          tmpColor.copy(pal.grassHigh).lerp(pal.peak, t);
        }

        // Paddy field tint (다랑논 물논 질감)
        if (this.paddyMask[idx] > 0.5 && h > WATER_LEVEL + 0.1) {
          const bund = Math.abs(Math.sin(vx * 2.6)) < 0.14 || Math.abs(Math.sin(vz * 2.6)) < 0.14;
          if (bund) {
            tmpColor.lerp(pal.grassMid, 0.7);
          } else {
            tmpColor.lerp(pal.paddy, 0.82);
          }
        }

        // Road surface tint
        const rMask = this.roadMask[idx];
        if (rMask > 0 && h >= WATER_LEVEL - 0.05) {
          if (rMask === 1) tmpColor.lerp(dirtRoadCol, 0.85);
          else if (rMask === 2) tmpColor.lerp(stoneRoadCol, 0.88);
          else if (rMask === 3) tmpColor.lerp(royalRoadCol, 0.9);
        }

        // Cliff & Rock junbeop (산수화 준법 암벽 표현)
        const rockFactor = Math.min(1, Math.max(0, (slope - 0.22) * 3.2 + rock * 0.75));
        if (rockFactor > 0.05) {
          tmpColor.lerp(pal.rock, rockFactor);
          // Vertical brush stroke texture on cliffs
          const stroke = Math.sin(vx * 4.5 + vz * 4.5) * 0.04 * rockFactor;
          tmpColor.offsetHSL(0, 0, stroke);
        }

        // Old Map Ink Contour Lines (등고 묵선 효과)
        if (this.inkContours && h > WATER_LEVEL + 0.05) {
          const contourStep = 1.15;
          const distToContour = Math.abs(((h / contourStep) + 0.5) % 1 - 0.5);
          if (distToContour < 0.032 && slope > 0.04) {
            tmpColor.lerp(inkColor, 0.28);
          }
          // Shoreline ink ring (수변 먹선)
          if (Math.abs(h - (WATER_LEVEL + 0.06)) < 0.05) {
            tmpColor.lerp(inkColor, 0.35);
          }
        }

        tmpColor.offsetHSL(0, 0, grain);
        colAttr.setXYZ(idx, tmpColor.r, tmpColor.g, tmpColor.b);
      }
    }
    colAttr.needsUpdate = true;

    // Update skirt geometry
    if (this.skirtMesh) {
      const sGeom = this.skirtMesh.geometry;
      const sPos = sGeom.getAttribute('position');
      const { borderIndices, baseDepth } = sGeom.userData;
      for (let i = 0; i < borderIndices.length; i++) {
        const vIdx = borderIndices[i];
        const x = posAttr.getX(vIdx);
        const y = posAttr.getY(vIdx);
        const z = posAttr.getZ(vIdx);
        sPos.setXYZ(i * 2, x, y, z);
        sPos.setXYZ(i * 2 + 1, x, baseDepth, z);
      }
      sPos.needsUpdate = true;
      sGeom.computeVertexNormals();
    }
  }

  // Generate scenic Korean landscape presets
  generateLandscape(type = 'andong') {
    const N = this.gridRes;
    const R = this.radius;
    this.rockiness.fill(0);
    this.roadMask.fill(0);
    this.paddyMask.fill(0);

    for (let iz = 0; iz <= N; iz++) {
      for (let ix = 0; ix <= N; ix++) {
        const idx = iz * (N + 1) + ix;
        const x = ((ix / N) * 2 - 1) * R;
        const z = ((iz / N) * 2 - 1) * R;
        const nx = x / R;
        const nz = z / R;

        let h = 0.65;

        if (type === 'andong') {
          // Hahoe Village S-curve river (물돌이 강변과 부용대 절벽)
          const riverZ = Math.sin(nx * 2.5) * 0.32 - 0.08;
          const distRiver = Math.abs(nz - riverZ - nx * 0.15);
          if (distRiver < 0.22) {
            const t = distRiver / 0.22;
            h = -1.15 * (1 - t * t) + 0.25 * t;
          } else {
            h = 0.55 + Math.min(1.8, (distRiver - 0.22) * 2.2);
          }
          // Buyongdae cliff in the north-west & Namsan hill in the south-east
          const cliffDist = Math.hypot(nx + 0.45, nz + 0.52);
          if (cliffDist < 0.48) {
            const ct = 1 - cliffDist / 0.48;
            h += ct * ct * 6.8;
            if (ct > 0.35) this.rockiness[idx] = 0.7;
          }
          const hillDist = Math.hypot(nx - 0.52, nz - 0.48);
          if (hillDist < 0.55) {
            const ht = 1 - hillDist / 0.55;
            h += ht * ht * 4.2;
          }
        } else if (type === 'palace') {
          // Mountain Fortress & Terraced Valley (북악산 배경의 산성·행궁 지형)
          const backMount = Math.hypot(nx * 0.85, nz + 0.55);
          if (backMount < 0.75) {
            const mt = 1 - backMount / 0.75;
            h += mt * mt * 8.2;
            this.rockiness[idx] = mt * 0.65;
          }
          // Left & right guardian ridges (좌청룡 우백호)
          const leftRidge = Math.hypot(nx + 0.65, nz + 0.05);
          if (leftRidge < 0.52) h += Math.pow(1 - leftRidge / 0.52, 2) * 4.5;
          const rightRidge = Math.hypot(nx - 0.65, nz + 0.05);
          if (rightRidge < 0.52) h += Math.pow(1 - rightRidge / 0.52, 2) * 4.2;

          // Front stream (전면 청계천/수구)
          const streamDist = Math.abs(nz - 0.46 - Math.sin(nx * 3.0) * 0.08);
          if (streamDist < 0.14) {
            h = -0.85 * (1 - streamDist / 0.14);
          }
        } else if (type === 'temple') {
          // Deep Mountain Gorge & Twin Peaks (깊은 협곡과 산사)
          const gorgeDist = Math.abs(nx - Math.sin(nz * 2.4) * 0.22);
          if (gorgeDist < 0.15) {
            h = -0.95 * (1 - gorgeDist / 0.15);
          } else {
            const side = Math.min(1, (gorgeDist - 0.15) / 0.65);
            h = 0.8 + side * side * 7.5 + Math.sin(nx * 5 + nz * 4) * 0.6;
            if (side > 0.4) this.rockiness[idx] = 0.65;
          }
          // Flatten a plateau for the temple
          const templePad = Math.hypot(nx + 0.36, nz + 0.12);
          if (templePad < 0.32) {
            const pt = 1 - templePad / 0.32;
            h = h * (1 - pt) + 2.6 * pt;
          }
        } else if (type === 'port') {
          // Coastal Harbor & Island (나루터 포구와 다도해 섬)
          const coastLine = nz - 0.15 - Math.sin(nx * 2.2) * 0.18;
          if (coastLine > 0) {
            h = -1.25 * Math.min(1, coastLine * 2.8);
            // Small scenic pine island in the bay
            const island = Math.hypot(nx - 0.38, nz - 0.52);
            if (island < 0.24) {
              h = -0.5 + Math.pow(1 - island / 0.24, 1.6) * 3.4;
              this.rockiness[idx] = 0.6;
            }
          } else {
            h = 0.5 + Math.min(4.8, Math.pow(-coastLine, 1.4) * 5.2);
          }
        } else {
          // Flat meadow
          h = 0.6 + (Math.sin(nx * 3) * Math.cos(nz * 3)) * 0.12;
        }

        this.heights[idx] = h;
      }
    }

    this.updateTerrainGeometry();
  }

  animateWater(time) {
    if (!this.waterMesh || !this.waterEnabled) return;
    this.waterMesh.position.y = WATER_LEVEL + Math.sin(time * 1.6) * 0.025;
  }
}
