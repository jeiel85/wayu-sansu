import * as THREE from 'three';
import { WATER_LEVEL } from './Turntable.js';
import {
  createGiwaHouse,
  createChogaHouse,
  createWallSegment,
  createFortressWallSegment,
  createPineTree,
  createBambooCluster,
  createSeasonalTree,
  createLandmark,
  createSailboat
} from './ProceduralModels.js';

const ZONE_NAME_POOLS = {
  giwa: ['청풍리(淸風里)', '연화동(蓮花洞)', '교동(校洞) 양반촌', '학마을 기와촌', '매화골 사랑채', '명월촌(明月村)'],
  choga: ['옹기골 초가촌', '황토마루 마을', '구름실 아랫마을', '감나무골 민가', '박꽃피는 마을', '산자락 정겨운리'],
  palace: ['북악 행궁(行宮)', '운림 산성(山城)', '청룡성(靑城)', '자미원 고궁', '수문장 성곽터'],
  paddy: ['풍년 다랑논', '황금들 경작지', '청류천 수리답', '두레 논밭뜰', '구름계단 다랑이'],
  forest: ['취적 송림(松林)', '청죽 대나무숲', '와룡 솔밭', '학소대 비경숲', '백운 소나무골'],
  temple: ['백운사(白雲寺)', '청량산사(山寺)', '도산 서원(書院)', '무량수전 도량', '송광 고찰'],
  dock: ['마포 나루터', '황포돛배 포구', '벽란도 수변', '물돌이 나루', '청강진 선착장'],
  market: ['종로 저잣거리', '보부상 오일장', '주막거리 장터', '남문 밖 큰장', '풍류 시전행랑']
};

export const ZONE_TYPE_LABELS = {
  giwa: '양반 기와촌',
  choga: '초가 민가촌',
  palace: '산성·궁궐',
  paddy: '다랑논·밭',
  forest: '송림·죽림',
  temple: '산사·서원',
  dock: '나루터·포구',
  market: '저잣거리·장터'
};

export class ZoneSystem {
  constructor(turntable, mats, audio, labelsContainer) {
    this.turntable = turntable;
    this.mats = mats;
    this.audio = audio;
    this.labelsContainer = labelsContainer;

    this.zonesGroup = new THREE.Group();
    this.turntable.group.add(this.zonesGroup);

    this.zones = []; // { id, type, name, polygon, center, group, labelEl, items }
    this.landmarks = []; // standalone landmarks
    this.sproutQueue = []; // animated growing items
    this.labelsVisible = true;
    this.nextId = 1;
  }

  setLabelsVisible(vis) {
    this.labelsVisible = vis;
    if (this.labelsContainer) {
      this.labelsContainer.style.display = vis ? 'block' : 'none';
    }
  }

  pickZoneName(type) {
    const pool = ZONE_NAME_POOLS[type] || ['산수 마을'];
    return pool[(this.nextId - 1) % pool.length];
  }

  // Simplify & resample polygon perimeter so walls and points are evenly spaced
  resamplePolygon(pts, spacing = 1.6) {
    if (pts.length < 3) return pts;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dist = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.floor(dist / spacing));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push({
          x: a.x + (b.x - a.x) * t,
          z: a.z + (b.z - a.z) * t
        });
      }
    }
    return out;
  }

  computePolygonInfo(poly) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let cx = 0, cz = 0;
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
      cx += p.x;
      cz += p.z;
      area += (p.x * q.z - q.x * p.z);
    }
    cx /= poly.length;
    cz /= poly.length;
    area = Math.abs(area) * 0.5;
    return { minX, maxX, minZ, maxZ, cx, cz, area };
  }

  // Register an object for spring pop-up animation (쑥쑥 자라나는 효과)
  enqueueSprout(obj3d, delaySec, targetScale = 1.0, soundIdx = 0) {
    obj3d.userData.targetScale = targetScale;
    obj3d.scale.setScalar(0.001);
    this.sproutQueue.push({
      obj: obj3d,
      delay: delaySec,
      elapsed: 0,
      targetScale,
      soundPlayed: false,
      soundIdx
    });
  }

  // Create a growing zone from drawn polygon points
  createZone(rawPolygon, type = 'giwa', options = {}) {
    const density = options.density ?? 1.0;
    const buildWalls = options.buildWalls ?? true;
    const customName = options.name || null;

    if (!rawPolygon || rawPolygon.length < 3) return null;
    const poly = this.resamplePolygon(rawPolygon, 1.4);
    const info = this.computePolygonInfo(poly);
    if (info.area < 4.5) return null; // Too small

    const zoneId = this.nextId++;
    const name = customName || this.pickZoneName(type);
    const group = new THREE.Group();
    this.zonesGroup.add(group);

    const items = []; // individual placed objects for erasing/counting
    let sproutIndex = 0;

    // If paddy field, paint paddy water mask on terrain
    if (type === 'paddy') {
      this.turntable.paintPaddyMask(poly, 1);
    }

    // 1. Perimeter Walls (돌담·꽃담 또는 산성 성곽)
    if (type === 'palace') {
      // Fortress walls around perimeter + main gate
      const gateIdx = 0;
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const y1 = this.turntable.getHeightAt(p1.x, p1.z);
        const y2 = this.turntable.getHeightAt(p2.x, p2.z);
        if (y1 < WATER_LEVEL - 0.1 || y2 < WATER_LEVEL - 0.1) continue;

        if (i === gateIdx) {
          // Arched fortress gatehouse (문루)
          const gate = createGiwaHouse(this.mats, 3, 1.15);
          gate.position.set((p1.x + p2.x) * 0.5, Math.max(y1, y2), (p1.z + p2.z) * 0.5);
          gate.rotation.y = Math.atan2(p2.x - p1.x, p2.z - p1.z) + Math.PI / 2;
          group.add(gate);
          items.push({ mesh: gate, x: gate.position.x, z: gate.position.z, kind: 'building' });
          this.enqueueSprout(gate, sproutIndex * 0.04, 1.15, sproutIndex++);
        } else {
          const seg = createFortressWallSegment(p1, p2, y1, y2, this.mats);
          if (seg) {
            group.add(seg);
            items.push({ mesh: seg, x: seg.position.x, z: seg.position.z, kind: 'wall' });
            this.enqueueSprout(seg, sproutIndex * 0.025, 1.0, sproutIndex++);
          }
        }
      }
    } else if (buildWalls && (type === 'giwa' || type === 'choga' || type === 'temple')) {
      const withTileCap = type !== 'choga';
      for (let i = 0; i < poly.length; i++) {
        // Leave openings for village entrances
        if (i % 6 === 0) continue;
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const y1 = this.turntable.getHeightAt(p1.x, p1.z);
        const y2 = this.turntable.getHeightAt(p2.x, p2.z);
        if (y1 < WATER_LEVEL + 0.05 || y2 < WATER_LEVEL + 0.05) continue;

        const seg = createWallSegment(p1, p2, y1, y2, this.mats, withTileCap);
        if (seg) {
          group.add(seg);
          items.push({ mesh: seg, x: seg.position.x, z: seg.position.z, kind: 'wall' });
          this.enqueueSprout(seg, sproutIndex * 0.02, 1.0, sproutIndex++);
        }
      }
    }

    // 2. Interior Procedural Generation by Zone Type
    const spacingMap = {
      giwa: 3.4 / Math.sqrt(density),
      choga: 2.9 / Math.sqrt(density),
      palace: 4.2 / Math.sqrt(density),
      paddy: 1.9 / Math.sqrt(density),
      forest: 1.75 / Math.sqrt(density),
      temple: 3.8 / Math.sqrt(density),
      dock: 3.1 / Math.sqrt(density),
      market: 2.5 / Math.sqrt(density)
    };
    const step = spacingMap[type] || 3.0;

    // Temple / Palace central main structure first!
    if (type === 'temple' || type === 'palace') {
      const cy = this.turntable.getHeightAt(info.cx, info.cz);
      if (cy >= WATER_LEVEL) {
        const mainHall = type === 'palace'
          ? createLandmark('gyeonghoeru', this.mats)
          : createGiwaHouse(this.mats, 3, 1.35);
        mainHall.position.set(info.cx, cy, info.cz);
        group.add(mainHall);
        items.push({ mesh: mainHall, x: info.cx, z: info.cz, kind: 'building' });
        this.enqueueSprout(mainHall, 0.08, type === 'palace' ? 0.95 : 1.35, sproutIndex++);

        if (type === 'temple') {
          // Place a stone pagoda in front of Daeungjeon
          const py = this.turntable.getHeightAt(info.cx, info.cz + 2.8);
          if (py >= WATER_LEVEL) {
            const pagoda = createLandmark('pagoda', this.mats);
            pagoda.position.set(info.cx, py, info.cz + 2.8);
            group.add(pagoda);
            items.push({ mesh: pagoda, x: info.cx, z: info.cz + 2.8, kind: 'building' });
            this.enqueueSprout(pagoda, 0.16, 0.9, sproutIndex++);
          }
        }
      }
    }

    // Candidate grid with organic jitter inside polygon
    for (let z = info.minZ + step * 0.5; z <= info.maxZ - step * 0.5; z += step) {
      for (let x = info.minX + step * 0.5; x <= info.maxX - step * 0.5; x += step) {
        const jx = x + (Math.random() - 0.5) * step * 0.55;
        const jz = z + (Math.random() - 0.5) * step * 0.55;

        if (!this.turntable.isInsidePlot(jx, jz, 1.5)) continue;
        if (!this.turntable.pointInPoly(jx, jz, poly)) continue;

        // Avoid overlapping central temple/palace hall
        if ((type === 'temple' || type === 'palace') && Math.hypot(jx - info.cx, jz - info.cz) < 3.6) {
          continue;
        }

        const y = this.turntable.getHeightAt(jx, jz);
        const slope = this.turntable.getSlopeAt(jx, jz);

        if (type === 'dock') {
          // Docks & Sailboats thrive near or on water!
          if (y < WATER_LEVEL - 0.08) {
            // Spawn Hwangpo Sailboat on water
            const boat = createSailboat(this.mats, Math.random() < 0.75);
            boat.position.set(jx, WATER_LEVEL + 0.02, jz);
            boat.rotation.y = Math.random() * Math.PI * 2;
            boat.userData.isFloatingBoat = true;
            boat.userData.floatPhase = Math.random() * Math.PI * 2;
            group.add(boat);
            items.push({ mesh: boat, x: jx, z: jz, kind: 'building' });
            this.enqueueSprout(boat, sproutIndex * 0.05, 0.9 + Math.random() * 0.25, sproutIndex++);
          } else if (y < WATER_LEVEL + 0.85) {
            // Riverside tavern (강변 주막) & wooden pier
            const jumak = createChogaHouse(this.mats, 1, 0.95);
            jumak.position.set(jx, y, jz);
            jumak.rotation.y = Math.atan2(info.cx - jx, info.cz - jz);
            group.add(jumak);
            items.push({ mesh: jumak, x: jx, z: jz, kind: 'building' });
            this.enqueueSprout(jumak, sproutIndex * 0.05, 0.95, sproutIndex++);
          }
          continue;
        }

        // Other zones require land above water
        if (y < WATER_LEVEL + 0.06) continue;
        if (slope > 0.38 && type !== 'forest') continue;

        if (type === 'giwa') {
          // Noble Hanok house + courtyard tree
          const variant = Math.floor(Math.random() * 4);
          const sc = 0.82 + Math.random() * 0.26;
          const house = createGiwaHouse(this.mats, variant, sc);
          house.position.set(jx, y, jz);
          // Orient softly along contour or south-facing with slight organic variance
          house.rotation.y = (Math.round(Math.random() * 4) * Math.PI * 0.5) + (Math.random() - 0.5) * 0.25;
          group.add(house);
          items.push({ mesh: house, x: jx, z: jz, kind: 'building' });
          this.enqueueSprout(house, sproutIndex * 0.045, sc, sproutIndex++);

          if (Math.random() < 0.65) {
            const tx = jx + (Math.random() - 0.5) * 2.2;
            const tz = jz + (Math.random() - 0.5) * 2.2;
            const ty = this.turntable.getHeightAt(tx, tz);
            if (ty > WATER_LEVEL + 0.1) {
              const tree = Math.random() < 0.45
                ? createPineTree(this.mats, 0.75)
                : createSeasonalTree(this.mats, Math.floor(Math.random() * 2), 0.75);
              tree.position.set(tx, ty, tz);
              group.add(tree);
              items.push({ mesh: tree, x: tx, z: tz, kind: 'tree' });
              this.enqueueSprout(tree, sproutIndex * 0.045 + 0.1, 0.75, sproutIndex);
            }
          }
        } else if (type === 'choga') {
          const variant = Math.floor(Math.random() * 2);
          const sc = 0.85 + Math.random() * 0.25;
          const hut = createChogaHouse(this.mats, variant, sc);
          hut.position.set(jx, y, jz);
          hut.rotation.y = Math.random() * Math.PI * 2;
          group.add(hut);
          items.push({ mesh: hut, x: jx, z: jz, kind: 'building' });
          this.enqueueSprout(hut, sproutIndex * 0.04, sc, sproutIndex++);

          if (Math.random() < 0.55) {
            const tree = createSeasonalTree(this.mats, 1, 0.75);
            const tx = jx + 1.2, tz = jz - 0.9;
            tree.position.set(tx, this.turntable.getHeightAt(tx, tz), tz);
            group.add(tree);
            items.push({ mesh: tree, x: tx, z: tz, kind: 'tree' });
            this.enqueueSprout(tree, sproutIndex * 0.04 + 0.08, 0.75, sproutIndex);
          }
        } else if (type === 'palace' || type === 'temple') {
          // Secondary halls, pavilions, pines, stone lanterns
          if (Math.random() < 0.55) {
            const hall = createGiwaHouse(this.mats, 0, 0.95);
            hall.position.set(jx, y, jz);
            hall.rotation.y = Math.atan2(info.cx - jx, info.cz - jz);
            group.add(hall);
            items.push({ mesh: hall, x: jx, z: jz, kind: 'building' });
            this.enqueueSprout(hall, sproutIndex * 0.05, 0.95, sproutIndex++);
          } else {
            const tree = type === 'temple' && Math.random() < 0.5
              ? createSeasonalTree(this.mats, 1, 0.95)
              : createPineTree(this.mats, 0.95);
            tree.position.set(jx, y, jz);
            group.add(tree);
            items.push({ mesh: tree, x: jx, z: jz, kind: 'tree' });
            this.enqueueSprout(tree, sproutIndex * 0.04, 0.95, sproutIndex++);
          }
        } else if (type === 'forest') {
          // Dense Pine & Bamboo forest + occasional rock or mountain pavilion
          const r = Math.random();
          let tree;
          const sc = 0.8 + Math.random() * 0.45;
          if (r < 0.52) {
            tree = createPineTree(this.mats, sc);
          } else if (r < 0.82) {
            tree = createBambooCluster(this.mats, sc);
          } else {
            tree = createSeasonalTree(this.mats, Math.floor(Math.random() * 2), sc);
          }
          tree.position.set(jx, y, jz);
          tree.rotation.y = Math.random() * Math.PI * 2;
          group.add(tree);
          items.push({ mesh: tree, x: jx, z: jz, kind: 'tree' });
          this.enqueueSprout(tree, sproutIndex * 0.02, sc, sproutIndex++);
        } else if (type === 'paddy') {
          // Rice crop rows, haystacks, and an occasional Wondumak (원두막)
          const rowGroup = new THREE.Group();
          rowGroup.position.set(jx, y, jz);
          if (Math.random() < 0.12) {
            // Thatched lookout pavilion (원두막)
            const hut = createLandmark('pavilion', this.mats);
            hut.position.set(jx, y, jz);
            group.add(hut);
            items.push({ mesh: hut, x: jx, z: jz, kind: 'building' });
            this.enqueueSprout(hut, sproutIndex * 0.03, 0.58, sproutIndex++);
          } else {
            // Rice shoots cluster
            for (let rx = -0.45; rx <= 0.45; rx += 0.45) {
              for (let rz = -0.45; rz <= 0.45; rz += 0.45) {
                const shoot = new THREE.Mesh(
                  new THREE.ConeGeometry(0.14, 0.34, 5),
                  this.mats.cropMat
                );
                shoot.position.set(rx, 0.17, rz);
                rowGroup.add(shoot);
              }
            }
            group.add(rowGroup);
            items.push({ mesh: rowGroup, x: jx, z: jz, kind: 'crop' });
            this.enqueueSprout(rowGroup, sproutIndex * 0.018, 1.0, sproutIndex++);
          }
        } else if (type === 'market') {
          // Bustling marketplace with canopy stalls, flags, and inns
          const stall = new THREE.Group();
          stall.position.set(jx, y, jz);
          stall.rotation.y = Math.random() * Math.PI * 2;

          if (Math.random() < 0.35) {
            const inn = createChogaHouse(this.mats, 0, 0.85);
            stall.add(inn);
          } else {
            const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.1), this.mats.canvasMat);
            canopy.position.y = 0.95;
            canopy.rotation.x = 0.12;
            canopy.castShadow = true;
            stall.add(canopy);

            [[-0.6, -0.45], [0.6, -0.45], [-0.6, 0.45], [0.6, 0.45]].forEach(([px, pz]) => {
              const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 5), this.mats.woodDarkMat);
              post.position.set(px, 0.47, pz);
              stall.add(post);
            });

            // Goods & sacks on table
            const table = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.7), this.mats.woodDarkMat);
            table.position.y = 0.2;
            stall.add(table);
          }

          group.add(stall);
          items.push({ mesh: stall, x: jx, z: jz, kind: 'building' });
          this.enqueueSprout(stall, sproutIndex * 0.035, 0.95, sproutIndex++);
        }
      }
    }

    // Create floating zone ribbon label
    const labelEl = this.createZoneLabelElement(zoneId, name, type);
    const zoneRecord = {
      id: zoneId,
      type,
      name,
      polygon: rawPolygon,
      center: { x: info.cx, z: info.cz },
      group,
      labelEl,
      items
    };
    this.zones.push(zoneRecord);
    return zoneRecord;
  }

  createZoneLabelElement(zoneId, name, type) {
    if (!this.labelsContainer) return null;
    const el = document.createElement('div');
    el.className = 'zl';
    el.dataset.zoneId = zoneId;
    el.title = '클릭하여 마을 지명 바꾸기';
    el.innerHTML = `
      <span class="rib">
        <span class="ty">${ZONE_TYPE_LABELS[type] || '마을'}</span>
        <span class="nm">${name}</span>
      </span>
      <span class="stem"></span>
    `;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const z = this.zones.find((item) => item.id === zoneId);
      if (!z) return;
      const next = window.prompt('이 구역의 새로운 화첩 지명(현판 이름)을 입력하세요:', z.name);
      if (next && next.trim()) {
        z.name = next.trim();
        const nmEl = el.querySelector('.nm');
        if (nmEl) nmEl.textContent = z.name;
      }
    });
    this.labelsContainer.appendChild(el);
    return el;
  }

  // Place standalone landmark
  placeLandmark(type, x, z, rotY = 0) {
    if (!this.turntable.isInsidePlot(x, z, 1.2)) return null;
    const y = Math.max(WATER_LEVEL, this.turntable.getHeightAt(x, z));
    const mesh = createLandmark(type, this.mats);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    this.zonesGroup.add(mesh);

    const targetScale = 1.0;
    this.enqueueSprout(mesh, 0, targetScale, this.landmarks.length);
    const rec = { type, x, z, rotY, mesh };
    this.landmarks.push(rec);
    return rec;
  }

  // Erase buildings/trees/landmarks within brush radius
  eraseAt(x, z, radius) {
    let removed = 0;

    // 1. Check zone items
    for (let zi = this.zones.length - 1; zi >= 0; zi--) {
      const zone = this.zones[zi];
      for (let ii = zone.items.length - 1; ii >= 0; ii--) {
        const it = zone.items[ii];
        if (Math.hypot(it.x - x, it.z - z) <= radius) {
          zone.group.remove(it.mesh);
          zone.items.splice(ii, 1);
          removed++;
        }
      }
      if (zone.items.length === 0) {
        this.zonesGroup.remove(zone.group);
        if (zone.labelEl) zone.labelEl.remove();
        this.zones.splice(zi, 1);
      }
    }

    // 2. Check standalone landmarks
    for (let li = this.landmarks.length - 1; li >= 0; li--) {
      const lm = this.landmarks[li];
      if (Math.hypot(lm.x - x, lm.z - z) <= radius) {
        this.zonesGroup.remove(lm.mesh);
        this.landmarks.splice(li, 1);
        removed++;
      }
    }

    return removed;
  }

  clearAll() {
    while (this.zonesGroup.children.length > 0) {
      this.zonesGroup.remove(this.zonesGroup.children[0]);
    }
    if (this.labelsContainer) {
      this.labelsContainer.innerHTML = '';
    }
    this.zones = [];
    this.landmarks = [];
    this.sproutQueue = [];
  }

  // Re-anchor all objects to terrain height when terrain is sculpted
  syncHeightsToTerrain() {
    for (const zone of this.zones) {
      for (const it of zone.items) {
        if (it.mesh.userData.isFloatingBoat) {
          it.mesh.position.y = WATER_LEVEL + 0.02;
        } else {
          it.mesh.position.y = Math.max(WATER_LEVEL, this.turntable.getHeightAt(it.x, it.z));
        }
      }
    }
    for (const lm of this.landmarks) {
      lm.mesh.position.y = Math.max(WATER_LEVEL, this.turntable.getHeightAt(lm.x, lm.z));
    }
  }

  // Update spring animations, watermills, floating boats, and 2D screen labels
  update(dt, time, camera, canvasWidth, canvasHeight) {
    // 1. Update sprout pop-in animations
    for (let i = this.sproutQueue.length - 1; i >= 0; i--) {
      const item = this.sproutQueue[i];
      item.elapsed += dt;
      if (item.elapsed < item.delay) continue;

      if (!item.soundPlayed) {
        item.soundPlayed = true;
        if (this.audio && item.soundIdx % 3 === 0) {
          this.audio.playSprout(item.soundIdx);
        }
      }

      const t = Math.min(1, (item.elapsed - item.delay) / 0.42);
      // Elastic overshoot curve
      const spring = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.65);
      item.obj.scale.setScalar(Math.max(0.01, item.targetScale * spring));

      if (t >= 1) {
        item.obj.scale.setScalar(item.targetScale);
        this.sproutQueue.splice(i, 1);
      }
    }

    // 2. Rotate watermill wheels & bob sailboats
    for (const lm of this.landmarks) {
      if (lm.mesh.userData.waterWheel) {
        lm.mesh.userData.waterWheel.rotation.x = time * 1.2;
      }
    }
    for (const zone of this.zones) {
      for (const it of zone.items) {
        if (it.mesh.userData.isFloatingBoat) {
          const ph = it.mesh.userData.floatPhase || 0;
          it.mesh.position.y = WATER_LEVEL + 0.03 + Math.sin(time * 2.0 + ph) * 0.04;
          it.mesh.rotation.z = Math.sin(time * 1.5 + ph) * 0.05;
        }
      }
    }

    // 3. Project zone centers to 2D screen coordinates for floating ribbons
    if (this.labelsVisible && camera) {
      const v = new THREE.Vector3();
      for (const zone of this.zones) {
        if (!zone.labelEl) continue;
        const h = Math.max(WATER_LEVEL, this.turntable.getHeightAt(zone.center.x, zone.center.z));
        v.set(zone.center.x, h + 2.6, zone.center.z);
        v.applyMatrix4(this.turntable.group.matrixWorld);
        v.project(camera);

        if (v.z > 1 || v.z < -1) {
          zone.labelEl.style.display = 'none';
          continue;
        }
        zone.labelEl.style.display = 'block';
        const sx = (v.x * 0.5 + 0.5) * canvasWidth;
        const sy = (-v.y * 0.5 + 0.5) * canvasHeight;
        zone.labelEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    }
  }

  getStats() {
    let buildings = this.landmarks.length;
    let trees = 0;
    for (const zone of this.zones) {
      for (const it of zone.items) {
        if (it.kind === 'building') buildings++;
        else if (it.kind === 'tree') trees++;
      }
    }
    const pop = buildings * 4;
    return {
      buildings,
      trees,
      pop,
      zones: this.zones.length
    };
  }
}
