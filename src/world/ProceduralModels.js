import * as THREE from 'three';

// Shared seasonal & night-glow material registry so changing season/time updates existing objects smoothly
export class MaterialBank {
  constructor() {
    this.season = 'summer';
    this.timeOfDay = 'day';

    // Base architectural materials
    this.giwaMat = new THREE.MeshStandardMaterial({ color: 0x343c44, roughness: 0.72, metalness: 0.12 });
    this.giwaRidgeMat = new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.65, metalness: 0.15 });
    this.chogaMat = new THREE.MeshStandardMaterial({ color: 0xc9a35b, roughness: 0.92, metalness: 0.02 });
    this.woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4b311f, roughness: 0.8 });
    this.woodRedMat = new THREE.MeshStandardMaterial({ color: 0x7a2b22, roughness: 0.72 }); // 단청 적색 기둥
    this.dancheongGreenMat = new THREE.MeshStandardMaterial({ color: 0x3b6e5c, roughness: 0.75 }); // 단청 뇌록색
    this.plasterMat = new THREE.MeshStandardMaterial({ color: 0xf0e7d5, roughness: 0.88 });
    this.ochreWallMat = new THREE.MeshStandardMaterial({ color: 0xd4b483, roughness: 0.9 });
    this.stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b867d, roughness: 0.88 });
    this.darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x5c5954, roughness: 0.9 });
    this.onggiMat = new THREE.MeshStandardMaterial({ color: 0x472818, roughness: 0.35, metalness: 0.15 });
    this.sailMat = new THREE.MeshStandardMaterial({ color: 0xd8a85c, roughness: 0.85, side: THREE.DoubleSide });
    this.canvasMat = new THREE.MeshStandardMaterial({ color: 0xeae0cb, roughness: 0.88, side: THREE.DoubleSide });

    // Glowing paper window & lantern material (창호지 호롱불 & 석등)
    this.windowMat = new THREE.MeshStandardMaterial({
      color: 0xf5ebd6,
      emissive: 0xff9d3b,
      emissiveIntensity: 0.0,
      roughness: 0.6
    });
    this.lanternGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffe4b5,
      emissive: 0xffaa33,
      emissiveIntensity: 0.15,
      roughness: 0.4
    });

    // Seasonal foliage materials
    this.pineFoliageMat = new THREE.MeshStandardMaterial({ color: 0x2f5438, roughness: 0.85 });
    this.bambooMat = new THREE.MeshStandardMaterial({ color: 0x567d46, roughness: 0.72 });
    this.deciduousMatA = new THREE.MeshStandardMaterial({ color: 0x4f783e, roughness: 0.85 });
    this.deciduousMatB = new THREE.MeshStandardMaterial({ color: 0x688f4e, roughness: 0.85 });
    this.cropMat = new THREE.MeshStandardMaterial({ color: 0x729c44, roughness: 0.88 });
    this.pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b3e28, roughness: 0.88 });
  }

  updateAtmosphere(season, timeOfDay) {
    this.season = season || this.season;
    this.timeOfDay = timeOfDay || this.timeOfDay;

    // Night / Sunset window glow
    if (this.timeOfDay === 'night') {
      this.windowMat.emissiveIntensity = 1.35;
      this.windowMat.color.setHex(0xffd28a);
      this.lanternGlowMat.emissiveIntensity = 1.8;
    } else if (this.timeOfDay === 'sunset') {
      this.windowMat.emissiveIntensity = 0.55;
      this.windowMat.color.setHex(0xf7dec0);
      this.lanternGlowMat.emissiveIntensity = 0.9;
    } else {
      this.windowMat.emissiveIntensity = 0.0;
      this.windowMat.color.setHex(0xf5ebd6);
      this.lanternGlowMat.emissiveIntensity = 0.1;
    }

    // Seasonal foliage & roof frost
    if (this.season === 'spring') {
      this.pineFoliageMat.color.setHex(0x355e3e);
      this.bambooMat.color.setHex(0x638f4e);
      this.deciduousMatA.color.setHex(0xe8a6b8); // 매화/벚꽃 분홍
      this.deciduousMatB.color.setHex(0x88b058); // 봄 연두
      this.cropMat.color.setHex(0x84b553);
      this.giwaMat.color.setHex(0x343c44);
      this.chogaMat.color.setHex(0xc9a35b);
    } else if (this.season === 'summer') {
      this.pineFoliageMat.color.setHex(0x2b4f34);
      this.bambooMat.color.setHex(0x4e7a3e);
      this.deciduousMatA.color.setHex(0x426e36);
      this.deciduousMatB.color.setHex(0x5c8544);
      this.cropMat.color.setHex(0x63963b);
      this.giwaMat.color.setHex(0x343c44);
      this.chogaMat.color.setHex(0xc9a35b);
    } else if (this.season === 'autumn') {
      this.pineFoliageMat.color.setHex(0x2f4f35);
      this.bambooMat.color.setHex(0x6e8544);
      this.deciduousMatA.color.setHex(0xc2462b); // 단풍 진홍
      this.deciduousMatB.color.setHex(0xe0a234); // 은행 황금빛
      this.cropMat.color.setHex(0xdba642); // 황금 벼
      this.giwaMat.color.setHex(0x363c42);
      this.chogaMat.color.setHex(0xc2984e);
    } else if (this.season === 'winter') {
      this.pineFoliageMat.color.setHex(0x6d8275); // 눈 내려앉은 솔잎
      this.bambooMat.color.setHex(0x7d9478);
      this.deciduousMatA.color.setHex(0xdce2e6); // 설경 가지
      this.deciduousMatB.color.setHex(0xe8edf0);
      this.cropMat.color.setHex(0xd8dcd6);
      this.giwaMat.color.setHex(0x707880); // 서리·눈 덮인 기와
      this.chogaMat.color.setHex(0xe2dfd7); // 눈 덮인 초가지붕
    }
  }
}

// Helper: Create a traditional Korean curved roof mesh (처마가 버선코처럼 살짝 들린 한옥 팔작/맞배 지붕)
export function createCurvedGiwaRoof(width, depth, height, mat, ridgeMat) {
  const group = new THREE.Group();
  const segX = 12;
  const segZ = 8;
  const geom = new THREE.BufferGeometry();
  const verts = [];
  const indices = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const v = iz / segZ; // 0 to 1
    const z = (v - 0.5) * depth;
    const distZ = Math.abs(v - 0.5) * 2; // 0 at center ridge, 1 at front/back eaves

    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const x = (u - 0.5) * width;
      const distX = Math.abs(u - 0.5) * 2; // 0 at center, 1 at left/right gable eaves

      // Roof profile: high along central ridge, sloping down in Z with concave curve (현수선 곡선)
      // Plus upturned corners (추녀/처마 끝 들림)
      const slopeCurve = Math.pow(1 - distZ, 1.45) * height;
      const hipCut = Math.max(0, (distX - 0.65) / 0.35) * (1 - distZ) * height * 0.42;
      const cornerLift = Math.pow(distX * distZ, 2.0) * height * 0.34;
      const eaveThickness = 0.08;

      const y = Math.max(0, slopeCurve - hipCut) + cornerLift + eaveThickness;
      verts.push(x, y, z);
    }
  }

  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * (segX + 1) + ix;
      const b = a + 1;
      const c = (iz + 1) * (segX + 1) + ix;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const roofMesh = new THREE.Mesh(geom, mat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  // Underside eave soffit box so it looks solid from low angles
  const soffit = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.92, 0.12, depth * 0.92),
    ridgeMat
  );
  soffit.position.y = 0.06;
  group.add(soffit);

  // Main Ridgebeam (용마루) with upturned ends (치미/망와)
  const ridgeLen = width * 0.72;
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(ridgeLen, 0.16, 0.16),
    ridgeMat
  );
  ridge.position.y = height + 0.08;
  group.add(ridge);

  // Left & Right decorative ridge tips (망와)
  [-1, 1].forEach((dir) => {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.18), ridgeMat);
    tip.position.set(dir * (ridgeLen * 0.5), height + 0.14, 0);
    tip.rotation.z = -dir * 0.25;
    group.add(tip);
  });

  return group;
}

// 1. GIWA HOUSE (한옥 기와집: ㅡ자, ㄱ자, ㅁ자, 누마루)
export function createGiwaHouse(mats, variant = 0, scale = 1.0) {
  const root = new THREE.Group();

  const addWing = (w, d, h, ox, oz, rotY = 0, isRoyal = false) => {
    const wing = new THREE.Group();
    wing.position.set(ox, 0, oz);
    wing.rotation.y = rotY;

    // Granite foundation plinth (화강암 기단)
    const plinthH = 0.32;
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.35, plinthH, d + 0.35),
      mats.stoneMat
    );
    plinth.position.y = plinthH * 0.5;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    wing.add(plinth);

    // Main wall body (회벽 + 기둥)
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.1, h, d - 0.1),
      mats.plasterMat
    );
    wall.position.y = plinthH + h * 0.5;
    wall.castShadow = true;
    wall.receiveShadow = true;
    wing.add(wall);

    // Corner & middle wooden pillars (기둥)
    const colMat = isRoyal ? mats.woodRedMat : mats.woodDarkMat;
    const nx = Math.max(2, Math.round(w / 0.85));
    for (let i = 0; i <= nx; i++) {
      const px = -w * 0.48 + (i / nx) * (w * 0.96);
      [-d * 0.48, d * 0.48].forEach((pz) => {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.11, h + 0.04, 0.11), colMat);
        col.position.set(px, plinthH + h * 0.5, pz);
        wing.add(col);
      });
    }

    // Glowing Changhoji paper window panels on front & back
    const winW = Math.min(w * 0.45, 1.1);
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(winW, h * 0.62, d + 0.02),
      mats.windowMat
    );
    win.position.set(0, plinthH + h * 0.48, 0);
    wing.add(win);

    // Wooden verandah (툇마루)
    const maru = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, 0.1, 0.34),
      mats.woodDarkMat
    );
    maru.position.set(0, plinthH + 0.08, d * 0.5 + 0.1);
    wing.add(maru);

    // Curved Giwa Roof
    const roof = createCurvedGiwaRoof(w + 0.72, d + 0.72, h * 0.72, mats.giwaMat, mats.giwaRidgeMat);
    roof.position.y = plinthH + h - 0.04;
    wing.add(roof);

    root.add(wing);
  };

  if (variant === 0) {
    // Classic straight Hanok (ㅡ자형 사랑채)
    addWing(2.4, 1.35, 1.05, 0, 0, 0);
  } else if (variant === 1) {
    // L-shaped Hanok (ㄱ자형 안채)
    addWing(2.5, 1.3, 1.08, 0, -0.45, 0);
    addWing(1.8, 1.25, 1.0, -0.85, 0.35, Math.PI / 2);
  } else if (variant === 2) {
    // U / Courtyard Noble Hanok (ㅁ자형 대가집)
    addWing(2.7, 1.25, 1.15, 0, -0.9, 0);
    addWing(2.1, 1.1, 0.98, -0.95, 0.05, Math.PI / 2);
    addWing(2.1, 1.1, 0.98, 0.95, 0.05, -Math.PI / 2);
    // Front gate wing (솟을대문 행랑채)
    addWing(2.5, 0.95, 0.88, 0, 0.95, 0);
  } else {
    // Two-story Scholar Pavilion Hanok (누마루 별당)
    addWing(2.2, 1.5, 1.0, 0, 0, 0);
    const upper = createCurvedGiwaRoof(1.7, 1.2, 0.68, mats.giwaMat, mats.giwaRidgeMat);
    upper.position.y = 1.95;
    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.9), mats.windowMat);
    upperBody.position.y = 1.62;
    root.add(upperBody);
    root.add(upper);
  }

  // Add tiny Jangdokdae (장독대 옹기 항아리들) next to the house
  const jangdok = createJangdokdae(mats);
  jangdok.position.set(1.35, 0, 0.65);
  root.add(jangdok);

  root.scale.setScalar(scale);
  root.userData.isBuilding = true;
  return root;
}

// 2. CHOGA HOUSE (정겨운 초가집: 둥근 볏짚 지붕과 황토벽)
export function createChogaHouse(mats, variant = 0, scale = 1.0) {
  const root = new THREE.Group();

  const buildHut = (w, d, h, ox, oz, rotY = 0) => {
    const hut = new THREE.Group();
    hut.position.set(ox, 0, oz);
    hut.rotation.y = rotY;

    // Low stone base
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2), mats.stoneMat);
    base.position.y = 0.1;
    hut.add(base);

    // Warm yellow-ochre mud wall (황토벽)
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.ochreWallMat);
    wall.position.y = 0.2 + h * 0.5;
    wall.castShadow = true;
    wall.receiveShadow = true;
    hut.add(wall);

    // Glowing paper door
    const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.38, h * 0.62, d + 0.03), mats.windowMat);
    door.position.y = 0.2 + h * 0.45;
    hut.add(door);

    // Rounded organic straw roof (초가지붕 - 부드러운 돔형 능선)
    const roofGroup = new THREE.Group();
    const domeGeom = new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
    domeGeom.scale(w * 0.68, h * 0.88, d * 0.72);
    const dome = new THREE.Mesh(domeGeom, mats.chogaMat);
    dome.castShadow = true;
    dome.receiveShadow = true;
    roofGroup.add(dome);

    // Woven straw ridge cap (용구새)
    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, w * 0.72, 8),
      mats.chogaMat
    );
    ridge.rotation.z = Math.PI / 2;
    ridge.position.y = h * 0.85;
    roofGroup.add(ridge);

    roofGroup.position.y = 0.2 + h * 0.85;
    hut.add(roofGroup);
    root.add(hut);
  };

  if (variant % 2 === 0) {
    buildHut(1.9, 1.25, 0.9, 0, 0, 0);
  } else {
    // L-shaped Choga (ㄱ자 초가와 외양간)
    buildHut(2.0, 1.2, 0.92, 0, -0.3, 0);
    buildHut(1.3, 1.05, 0.82, 0.75, 0.38, Math.PI / 2);
  }

  const jangdok = createJangdokdae(mats);
  jangdok.position.set(-1.1, 0, 0.55);
  root.add(jangdok);

  root.scale.setScalar(scale);
  root.userData.isBuilding = true;
  return root;
}

// Onggi Earthenware Jars Stand (장독대)
export function createJangdokdae(mats) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.48), mats.stoneMat);
  slab.position.y = 0.07;
  g.add(slab);

  const coords = [[-0.18, -0.08, 0.13], [0.02, -0.06, 0.14], [0.2, -0.08, 0.11], [-0.08, 0.1, 0.09], [0.12, 0.1, 0.1]];
  coords.forEach(([jx, jz, r]) => {
    const jar = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mats.onggiMat);
    jar.scale.set(1, 1.25, 1);
    jar.position.set(jx, 0.14 + r, jz);
    jar.castShadow = true;
    g.add(jar);
  });
  return g;
}

// 3. STONE / GIWA WALL SEGMENT (돌담·꽃담 구간 및 솟을대문)
export function createWallSegment(p1, p2, y1, y2, mats, withTileCap = true) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.2) return null;

  const group = new THREE.Group();
  const midX = (p1.x + p2.x) * 0.5;
  const midZ = (p1.z + p2.z) * 0.5;
  const midY = (y1 + y2) * 0.5;
  const angle = Math.atan2(dx, dz);

  group.position.set(midX, midY, midZ);
  group.rotation.y = angle;

  const wallH = 0.52;
  const wallW = 0.22;
  const wallGeom = new THREE.BoxGeometry(wallW, wallH, len + 0.08);
  const wallMesh = new THREE.Mesh(wallGeom, withTileCap ? mats.ochreWallMat : mats.stoneMat);
  wallMesh.position.y = wallH * 0.5;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  if (withTileCap) {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(wallW + 0.12, 0.1, len + 0.14),
      mats.giwaMat
    );
    cap.position.y = wallH + 0.04;
    cap.castShadow = true;
    group.add(cap);
  }

  return group;
}

// 4. FORTRESS WALL & GATE (산성 성곽 여장과 홍예 성문)
export function createFortressWallSegment(p1, p2, y1, y2, mats) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.4) return null;

  const group = new THREE.Group();
  group.position.set((p1.x + p2.x) * 0.5, (y1 + y2) * 0.5, (p1.z + p2.z) * 0.5);
  group.rotation.y = Math.atan2(dx, dz);

  const wallH = 1.45;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, wallH, len + 0.15), mats.stoneMat);
  body.position.y = wallH * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Crenellations (성가퀴 / 여장)
  const merlonCount = Math.max(1, Math.floor(len / 0.75));
  for (let i = 0; i < merlonCount; i++) {
    const mz = -len * 0.45 + (i / Math.max(1, merlonCount - 1)) * (len * 0.9);
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.28, 0.45), mats.darkStoneMat);
    merlon.position.set(0, wallH + 0.14, mz);
    group.add(merlon);
  }

  return group;
}

// 5. KOREAN TREES (적송 소나무, 대나무, 매화/단풍/은행나무, 괴석)
export function createPineTree(mats, scale = 1.0) {
  const g = new THREE.Group();

  // Sinuous twisted red pine trunk (구불구불한 한국 적송 줄기)
  const h = 1.6 + Math.random() * 0.8;
  const trunk1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, h * 0.58, 7), mats.pineTrunkMat);
  trunk1.position.y = h * 0.28;
  trunk1.rotation.z = 0.14;
  trunk1.castShadow = true;
  g.add(trunk1);

  const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h * 0.55, 7), mats.pineTrunkMat);
  trunk2.position.set(-0.12, h * 0.72, 0.05);
  trunk2.rotation.z = -0.22;
  trunk2.castShadow = true;
  g.add(trunk2);

  // Layered flat cloud-like pine needle pads (산수화풍 솔잎 구름 층)
  const layers = [
    { x: -0.22, y: h * 0.98, z: 0.05, rx: 0.78, ry: 0.28, rz: 0.68 },
    { x: 0.25, y: h * 0.76, z: -0.08, rx: 0.62, ry: 0.24, rz: 0.56 },
    { x: -0.05, y: h * 1.15, z: -0.04, rx: 0.55, ry: 0.24, rz: 0.52 }
  ];
  layers.forEach((l) => {
    const pad = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), mats.pineFoliageMat);
    pad.scale.set(l.rx, l.ry, l.rz);
    pad.position.set(l.x, l.y, l.z);
    pad.castShadow = true;
    pad.receiveShadow = true;
    g.add(pad);
  });

  g.scale.setScalar(scale);
  g.userData.isTree = true;
  return g;
}

export function createBambooCluster(mats, scale = 1.0) {
  const g = new THREE.Group();
  const count = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const ox = (Math.random() - 0.5) * 0.45;
    const oz = (Math.random() - 0.5) * 0.45;
    const h = 1.8 + Math.random() * 1.1;
    const culm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.048, h, 6), mats.bambooMat);
    culm.position.set(ox, h * 0.5, oz);
    culm.rotation.z = (Math.random() - 0.5) * 0.12;
    culm.castShadow = true;
    g.add(culm);

    // Leafy top tuft
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.75, 6), mats.bambooMat);
    tuft.position.set(ox, h * 0.88, oz);
    tuft.castShadow = true;
    g.add(tuft);
  }
  g.scale.setScalar(scale);
  g.userData.isTree = true;
  return g;
}

export function createSeasonalTree(mats, variant = 0, scale = 1.0) {
  const g = new THREE.Group();
  const h = 1.3 + Math.random() * 0.5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, h * 0.65, 7), mats.woodDarkMat);
  trunk.position.y = h * 0.32;
  trunk.castShadow = true;
  g.add(trunk);

  const folMat = variant % 2 === 0 ? mats.deciduousMatA : mats.deciduousMatB;
  const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 1), folMat);
  crown.scale.set(1.1, 0.82, 1.05);
  crown.position.y = h * 0.82;
  crown.castShadow = true;
  g.add(crown);

  const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 1), folMat);
  crown2.position.set(0.32, h * 0.68, 0.18);
  crown2.castShadow = true;
  g.add(crown2);

  g.scale.setScalar(scale);
  g.userData.isTree = true;
  return g;
}

// 6. LANDMARKS & SPECIAL STRUCTURES (경회루, 다층석탑, 육모정, 물레방아, 당산나무, 봉수대, 홍살문, 나룻배)
export function createLandmark(type, mats) {
  const root = new THREE.Group();
  root.userData.landmarkType = type;
  root.userData.isBuilding = true;

  if (type === 'gyeonghoeru') {
    // Grand two-tier water pavilion on stone pillars (경회루 수상 대누각)
    const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.45, 3.8), mats.stoneMat);
    base.position.y = 0.22;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    // 1st floor tall stone columns (장대석 돌기둥)
    for (let ix = -2; ix <= 2; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.35, 8), mats.stoneMat);
        col.position.set(ix * 1.05, 0.45 + 0.67, iz * 1.25);
        col.castShadow = true;
        root.add(col);
      }
    }

    // 2nd floor royal pavilion hall & balustrade
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.18, 3.4), mats.woodRedMat);
    deck.position.y = 1.85;
    root.add(deck);

    const hall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.15, 2.5), mats.windowMat);
    hall.position.y = 2.48;
    hall.castShadow = true;
    root.add(hall);

    // Lower skirt roof + Upper grand paljak roof
    const roof1 = createCurvedGiwaRoof(5.6, 4.2, 0.75, mats.giwaMat, mats.giwaRidgeMat);
    roof1.position.y = 2.15;
    root.add(roof1);

    const roof2 = createCurvedGiwaRoof(4.6, 3.3, 1.15, mats.giwaMat, mats.giwaRidgeMat);
    roof2.position.y = 3.02;
    root.add(roof2);
  } else if (type === 'pagoda') {
    // 5-story Traditional Korean Stone Pagoda (오층석탑)
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 1.8), mats.stoneMat);
    pedestal.position.y = 0.275;
    pedestal.castShadow = true;
    root.add(pedestal);

    let curY = 0.55;
    for (let i = 0; i < 5; i++) {
      const s = 1.28 - i * 0.16;
      const bodyH = 0.44 - i * 0.04;
      const body = new THREE.Mesh(new THREE.BoxGeometry(s * 0.76, bodyH, s * 0.76), mats.stoneMat);
      body.position.y = curY + bodyH * 0.5;
      body.castShadow = true;
      root.add(body);
      curY += bodyH;

      const roofStone = new THREE.Mesh(new THREE.BoxGeometry(s * 1.15, 0.16, s * 1.15), mats.darkStoneMat);
      roofStone.position.y = curY + 0.08;
      roofStone.castShadow = true;
      root.add(roofStone);
      curY += 0.18;
    }
    // Finial spire (상륜부 노반·보주)
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 8), mats.lanternGlowMat);
    spire.position.y = curY + 0.32;
    root.add(spire);
  } else if (type === 'pavilion') {
    // Hexagonal Pavilion (육모정 정자)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.4, 6), mats.stoneMat);
    base.position.y = 0.2;
    base.castShadow = true;
    root.add(base);

    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.14, 6), mats.woodDarkMat);
    floor.position.y = 0.45;
    root.add(floor);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.25, 6), mats.woodRedMat);
      col.position.set(Math.cos(a) * 1.1, 1.05, Math.sin(a) * 1.1);
      col.castShadow = true;
      root.add(col);
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.85, 1.15, 6), mats.giwaMat);
    roof.position.y = 2.15;
    roof.castShadow = true;
    root.add(roof);
  } else if (type === 'watermill') {
    // Traditional Watermill (물레방앗간 + 회전 수차)
    const millHouse = createChogaHouse(mats, 0, 1.05);
    root.add(millHouse);

    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(1.25, 0.85, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 8, 16), mats.woodDarkMat);
    rim.rotation.y = Math.PI / 2;
    wheelGroup.add(rim);

    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.48, 0.08), mats.woodDarkMat);
      spoke.rotation.x = (i / 8) * Math.PI;
      wheelGroup.add(spoke);
    }
    root.add(wheelGroup);
    root.userData.waterWheel = wheelGroup;
  } else if (type === 'sacredtree') {
    // Dangsan Sacred Tree & Stone Mound Altar (당산나무와 성황당 돌무더기)
    const tree = createSeasonalTree(mats, 1, 2.15);
    root.add(tree);

    // Colorful prayer ribbons around trunk (오방색 금줄 천)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.25, 8), mats.woodRedMat);
    band.position.y = 0.85;
    root.add(band);

    // Stone cairn (돌무더기 제단)
    const cairn = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.85, 7), mats.stoneMat);
    cairn.position.set(1.2, 0.42, 0.4);
    cairn.castShadow = true;
    root.add(cairn);
  } else if (type === 'beacon') {
    // Mountain Fortress Smoke Beacon (산성 봉수대)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 1.4, 12), mats.stoneMat);
    base.position.y = 0.7;
    base.castShadow = true;
    root.add(base);

    for (let i = -1; i <= 1; i++) {
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.9, 8), mats.darkStoneMat);
      chimney.position.set(i * 0.65, 1.75, 0);
      root.add(chimney);

      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mats.lanternGlowMat);
      fire.position.set(i * 0.65, 2.22, 0);
      root.add(fire);
    }
    root.userData.hasSmoke = true;
  } else if (type === 'hongsalmun') {
    // Red Arrow Gate (홍살문)
    [-1.1, 1.1].forEach((px) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 8), mats.woodRedMat);
      post.position.set(px, 1.3, 0);
      post.castShadow = true;
      root.add(post);
    });
    const beam1 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.12), mats.woodRedMat);
    beam1.position.y = 2.15;
    root.add(beam1);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.12), mats.woodRedMat);
    beam2.position.y = 2.48;
    root.add(beam2);

    // 태극 문양 및 홍살 창살
    for (let i = -4; i <= 4; i++) {
      const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5), mats.woodRedMat);
      arrow.position.set(i * 0.24, 2.38, 0);
      root.add(arrow);
    }
  } else {
    // Jangseung & Dolhareubang Guardian Statues (천하대장군 장승과 돌하르방)
    [-0.55, 0.55].forEach((px, idx) => {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 1.45, 7),
        idx === 0 ? mats.woodDarkMat : mats.darkStoneMat
      );
      body.position.set(px, 0.72, 0);
      body.castShadow = true;
      root.add(body);

      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 0.35, 7),
        mats.giwaRidgeMat
      );
      hat.position.set(px, 1.55, 0);
      root.add(hat);
    });
  }

  return root;
}

// 7. HWANGPO SAILBOAT (황포돛배 나룻배)
export function createSailboat(mats, withSail = true) {
  const boat = new THREE.Group();

  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.28, 2.1), mats.woodDarkMat);
  hull.position.y = 0.1;
  hull.castShadow = true;
  boat.add(hull);

  if (withSail) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 6), mats.woodDarkMat);
    mast.position.set(0, 1.0, 0.1);
    boat.add(mast);

    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.35), mats.sailMat);
    sail.position.set(0, 1.1, 0.14);
    sail.rotation.y = 0.2;
    sail.castShadow = true;
    boat.add(sail);
  }

  return boat;
}

// 8. ARCHED STONE BRIDGE (전통 홍예교 / 무지개 돌다리 & 목교)
export function createBridge(p1, p2, mats, style = 'arch') {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  const group = new THREE.Group();

  group.position.set((p1.x + p2.x) * 0.5, 0, (p1.z + p2.z) * 0.5);
  group.rotation.y = Math.atan2(dx, dz);

  const segs = 12;
  const bridgeW = style === 'arch' ? 1.55 : 1.25;
  const archH = style === 'arch' ? Math.min(1.45, len * 0.22) : 0.45;
  const mat = style === 'arch' ? mats.stoneMat : mats.woodDarkMat;
  const railMat = style === 'arch' ? mats.darkStoneMat : mats.woodRedMat;

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const tm = (t0 + t1) * 0.5;
    const z = (tm - 0.5) * len;
    const y = Math.sin(tm * Math.PI) * archH + 0.18;
    const slopeAngle = Math.cos(tm * Math.PI) * (archH * Math.PI / len);

    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeW, 0.22, (len / segs) + 0.08),
      mat
    );
    plank.position.set(0, y, z);
    plank.rotation.x = -slopeAngle;
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);

    // Side balustrades (돌난간 / 나무난간)
    [-bridgeW * 0.45, bridgeW * 0.45].forEach((rx) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), railMat);
      post.position.set(rx, y + 0.22, z);
      group.add(post);
    });
  }

  return group;
}
