import * as THREE from 'three';
import { WATER_LEVEL } from './Turntable.js';

export class LifeAndWeather {
  constructor(turntable, zoneSystem, roadSystem) {
    this.turntable = turntable;
    this.zoneSystem = zoneSystem;
    this.roadSystem = roadSystem;

    this.group = new THREE.Group();
    this.turntable.group.add(this.group);

    this.lifeEnabled = true;
    this.weather = 'clear'; // 'clear' | 'mist' | 'rain' | 'snow' | 'blossom' | 'rainbow'
    this.timeOfDay = 'day';

    this.villagers = [];
    this.cranes = [];
    this.smokePuffs = [];
    this.mistClouds = [];
    this.particles = null;
    this.rainbowGroup = null;

    this.initCranes();
    this.initMistClouds();
    this.initRainbow();
    this.initParticleSystem();
  }

  setLifeEnabled(enabled) {
    this.lifeEnabled = enabled;
    for (const v of this.villagers) v.mesh.visible = enabled;
    for (const c of this.cranes) c.mesh.visible = enabled;
    for (const s of this.smokePuffs) s.mesh.visible = enabled;
  }

  setWeather(weather) {
    this.weather = weather;
    if (this.rainbowGroup) {
      this.rainbowGroup.visible = (weather === 'rainbow');
    }
    this.updateMistVisibility();
    this.updateParticleAppearance();
  }

  setTimeOfDay(timeOfDay) {
    this.timeOfDay = timeOfDay;
    this.updateMistVisibility();
  }

  // Soaring Korean White Cranes (단정학/두루미)
  initCranes() {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.7 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.8 });

    for (let i = 0; i < 5; i++) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 5), whiteMat);
      body.rotation.x = Math.PI / 2;
      bird.add(body);

      const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.18), whiteMat);
      leftWing.position.set(-0.3, 0, 0);
      const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.18), whiteMat);
      rightWing.position.set(0.3, 0, 0);

      const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.16), blackMat);
      tipL.position.set(-0.28, 0, 0);
      leftWing.add(tipL);
      const tipR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.16), blackMat);
      tipR.position.set(0.28, 0, 0);
      rightWing.add(tipR);

      bird.add(leftWing);
      bird.add(rightWing);

      this.group.add(bird);
      this.cranes.push({
        mesh: bird,
        leftWing,
        rightWing,
        angle: (i / 5) * Math.PI * 2,
        radius: 10 + (i % 3) * 5.5,
        height: 8.5 + (i % 2) * 2.2,
        speed: 0.24 + i * 0.03
      });
    }
  }

  // Mountain Mist / Cloud Sea (운해·산안개)
  initMistClouds() {
    const mistMat = new THREE.MeshStandardMaterial({
      color: 0xf4eee1,
      transparent: true,
      opacity: 0.36,
      roughness: 1.0,
      depthWrite: false
    });

    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mistMat);
        puff.scale.set(3.2 + j * 1.1, 0.52, 1.8 + j * 0.6);
        puff.position.set((j - 1) * 1.8, j * 0.12, (j % 2) * 0.6);
        cloud.add(puff);
      }
      const angle = (i / 14) * Math.PI * 2;
      const dist = 6 + (i % 4) * 5.5;
      cloud.position.set(Math.cos(angle) * dist, 2.2 + (i % 3) * 1.4, Math.sin(angle) * dist);
      this.group.add(cloud);
      this.mistClouds.push({
        mesh: cloud,
        baseX: cloud.position.x,
        baseY: cloud.position.y,
        baseZ: cloud.position.z,
        phase: i * 0.9
      });
    }
    this.updateMistVisibility();
  }

  updateMistVisibility() {
    const showMist = this.weather === 'mist' || this.timeOfDay === 'dawn';
    const count = this.weather === 'mist' ? this.mistClouds.length : (this.timeOfDay === 'dawn' ? 7 : 3);
    this.mistClouds.forEach((c, idx) => {
      c.mesh.visible = showMist || idx < count;
    });
  }

  // Watercolor Rainbow Arc (수채화 무지개)
  initRainbow() {
    this.rainbowGroup = new THREE.Group();
    const colors = [0xc95b50, 0xdba053, 0xd6c865, 0x6ea872, 0x5c8ca8, 0x7c6ba0];
    colors.forEach((hex, idx) => {
      const radius = 24 - idx * 0.48;
      const geom = new THREE.TorusGeometry(radius, 0.24, 8, 64, Math.PI);
      const mat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.34,
        depthWrite: false
      });
      const arc = new THREE.Mesh(geom, mat);
      this.rainbowGroup.add(arc);
    });
    this.rainbowGroup.position.set(0, -1.5, -6);
    this.rainbowGroup.rotation.y = -0.35;
    this.rainbowGroup.visible = false;
    this.group.add(this.rainbowGroup);
  }

  // Weather Particles (보슬비·함박눈·봄 꽃비)
  initParticleSystem() {
    const count = 650;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 65;
      positions[i * 3 + 1] = Math.random() * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 65;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.32,
      transparent: true,
      opacity: 0.75
    });

    this.particles = new THREE.Points(geom, mat);
    this.particles.visible = false;
    this.group.add(this.particles);
  }

  updateParticleAppearance() {
    if (!this.particles) return;
    const w = this.weather;
    if (w === 'rain') {
      this.particles.visible = true;
      this.particles.material.color.setHex(0x8aa8b8);
      this.particles.material.size = 0.22;
      this.particles.material.opacity = 0.65;
    } else if (w === 'snow') {
      this.particles.visible = true;
      this.particles.material.color.setHex(0xffffff);
      this.particles.material.size = 0.38;
      this.particles.material.opacity = 0.85;
    } else if (w === 'blossom') {
      this.particles.visible = true;
      this.particles.material.color.setHex(0xf4b8c8); // 매화/벚꽃잎
      this.particles.material.size = 0.36;
      this.particles.material.opacity = 0.85;
    } else {
      this.particles.visible = false;
    }
  }

  // Ensure villager count scales with number of buildings
  syncVillagers() {
    const stats = this.zoneSystem.getStats();
    const targetCount = Math.min(28, Math.max(0, Math.floor(stats.buildings * 0.85)));

    while (this.villagers.length < targetCount) {
      const v = this.createVillager(this.villagers.length);
      this.villagers.push(v);
      this.group.add(v.mesh);
    }
    while (this.villagers.length > targetCount) {
      const v = this.villagers.pop();
      this.group.remove(v.mesh);
    }
  }

  createVillager(index) {
    const g = new THREE.Group();
    const robeColors = [0xf2ece1, 0xd8e2dc, 0xe8d5b7, 0xc77d63, 0x6b8cae];
    const robeMat = new THREE.MeshStandardMaterial({
      color: robeColors[index % robeColors.length],
      roughness: 0.85
    });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe8c8a8, roughness: 0.8 });
    const gatMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 });

    // Durumagi / Hanbok body
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), robeMat);
    body.position.y = 0.21;
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), headMat);
    head.position.y = 0.46;
    g.add(head);

    // Traditional Korean Gat hat (선비 갓) on half of villagers
    if (index % 2 === 0) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 8), gatMat);
      brim.position.y = 0.53;
      g.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.11, 6), gatMat);
      crown.position.y = 0.58;
      g.add(crown);
    }

    const startPt = this.pickWalkTarget();
    g.position.set(startPt.x, Math.max(WATER_LEVEL, this.turntable.getHeightAt(startPt.x, startPt.z)), startPt.z);
    g.visible = this.lifeEnabled;

    return {
      mesh: g,
      x: startPt.x,
      z: startPt.z,
      tx: startPt.x,
      tz: startPt.z,
      speed: 0.9 + Math.random() * 0.55,
      bobPhase: Math.random() * Math.PI * 2
    };
  }

  pickWalkTarget() {
    // Prefer points inside existing land zones or along roads
    const landZones = this.zoneSystem.zones.filter((z) => z.type !== 'dock');
    if (landZones.length > 0 && Math.random() < 0.75) {
      const z = landZones[Math.floor(Math.random() * landZones.length)];
      if (z.items.length > 0) {
        const it = z.items[Math.floor(Math.random() * z.items.length)];
        return {
          x: it.x + (Math.random() - 0.5) * 2.5,
          z: it.z + (Math.random() - 0.5) * 2.5
        };
      }
      return { x: z.center.x, z: z.center.z };
    }
    const r = this.turntable.radius * 0.65;
    for (let tries = 0; tries < 8; tries++) {
      const x = (Math.random() - 0.5) * r * 1.4;
      const z = (Math.random() - 0.5) * r * 1.4;
      if (this.turntable.getHeightAt(x, z) > WATER_LEVEL + 0.15) {
        return { x, z };
      }
    }
    return { x: 0, z: 0 };
  }

  spawnSmokePuff(x, y, z) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf2ece0,
      transparent: true,
      opacity: 0.48,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), mat);
    mesh.position.set(x, y, z);
    mesh.visible = this.lifeEnabled;
    this.group.add(mesh);
    this.smokePuffs.push({
      mesh,
      age: 0,
      maxAge: 3.2,
      vx: 0.18 + (Math.random() - 0.5) * 0.1,
      vz: (Math.random() - 0.5) * 0.1
    });
  }

  update(dt, time) {
    // 1. Update Cranes
    if (this.lifeEnabled) {
      for (const c of this.cranes) {
        c.angle += dt * c.speed;
        const x = Math.cos(c.angle) * c.radius;
        const z = Math.sin(c.angle) * c.radius;
        const y = c.height + Math.sin(time * 1.2 + c.angle) * 0.45;
        c.mesh.position.set(x, y, z);
        c.mesh.rotation.y = -c.angle;
        const flap = Math.sin(time * 5.5 + c.angle * 2) * 0.35;
        c.leftWing.rotation.z = flap;
        c.rightWing.rotation.z = -flap;
      }
    }

    // 2. Update Villagers walking between homes
    if (this.lifeEnabled) {
      if (Math.floor(time * 2) % 4 === 0) {
        this.syncVillagers();
      }
      for (const v of this.villagers) {
        const dx = v.tx - v.x;
        const dz = v.tz - v.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.35) {
          const next = this.pickWalkTarget();
          v.tx = next.x;
          v.tz = next.z;
        } else {
          const step = Math.min(dist, v.speed * dt);
          const nx = v.x + (dx / dist) * step;
          const nz = v.z + (dz / dist) * step;
          const ny = this.turntable.getHeightAt(nx, nz);
          if (ny < WATER_LEVEL - 0.05) {
            const next = this.pickWalkTarget();
            v.tx = next.x;
            v.tz = next.z;
          } else {
            v.x = nx;
            v.z = nz;
            const bob = Math.abs(Math.sin(time * 7 + v.bobPhase)) * 0.06;
            v.mesh.position.set(v.x, Math.max(WATER_LEVEL, ny) + bob, v.z);
            v.mesh.rotation.y = Math.atan2(dx, dz);
          }
        }
      }
    }

    // 3. Emit & update chimney smoke puffs
    if (this.lifeEnabled && Math.random() < 0.18) {
      // Pick a random house or beacon to emit smoke
      if (this.zoneSystem.zones.length > 0) {
        const z = this.zoneSystem.zones[Math.floor(Math.random() * this.zoneSystem.zones.length)];
        const houses = z.items.filter((i) => i.kind === 'building');
        if (houses.length > 0) {
          const h = houses[Math.floor(Math.random() * houses.length)];
          const groundY = Math.max(WATER_LEVEL, this.turntable.getHeightAt(h.x, h.z));
          this.spawnSmokePuff(h.x + 0.3, groundY + 1.45, h.z);
        }
      }
      for (const lm of this.zoneSystem.landmarks) {
        if (lm.mesh.userData.hasSmoke && Math.random() < 0.35) {
          const groundY = Math.max(WATER_LEVEL, this.turntable.getHeightAt(lm.x, lm.z));
          this.spawnSmokePuff(lm.x, groundY + 2.35, lm.z);
        }
      }
    }

    for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
      const s = this.smokePuffs[i];
      s.age += dt;
      if (s.age >= s.maxAge) {
        this.group.remove(s.mesh);
        s.mesh.material.dispose();
        this.smokePuffs.splice(i, 1);
        continue;
      }
      const p = s.age / s.maxAge;
      s.mesh.position.y += dt * 0.75;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.z += s.vz * dt;
      s.mesh.scale.setScalar(1 + p * 2.4);
      s.mesh.material.opacity = (1 - p) * 0.42;
    }

    // 4. Drift mountain mist clouds
    for (const c of this.mistClouds) {
      if (!c.mesh.visible) continue;
      c.mesh.position.x = c.baseX + Math.sin(time * 0.25 + c.phase) * 1.8;
      c.mesh.position.z = c.baseZ + Math.cos(time * 0.2 + c.phase) * 1.4;
    }

    // 5. Animate falling weather particles
    if (this.particles && this.particles.visible) {
      const pos = this.particles.geometry.getAttribute('position');
      const vy = this.weather === 'rain' ? 16.0 : 2.8;
      const sway = this.weather === 'rain' ? 1.5 : 2.2;
      for (let i = 0; i < pos.count; i++) {
        let px = pos.getX(i);
        let py = pos.getY(i);
        let pz = pos.getZ(i);

        py -= vy * dt;
        px += Math.sin(time + i) * sway * dt;
        if (py < 0) {
          py = 24;
          px = (Math.random() - 0.5) * 65;
          pz = (Math.random() - 0.5) * 65;
        }
        pos.setXYZ(i, px, py, pz);
      }
      pos.needsUpdate = true;
    }
  }
}
