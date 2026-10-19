import * as THREE from 'three';
import { WATER_LEVEL } from './Turntable.js';
import { createBridge } from './ProceduralModels.js';

export class RoadSystem {
  constructor(turntable, mats) {
    this.turntable = turntable;
    this.mats = mats;
    this.roadsGroup = new THREE.Group();
    this.turntable.group.add(this.roadsGroup);

    this.roads = []; // { points, roadType, bridgeType, meshes }
  }

  addRoadPath(rawPoints, roadType = 'dirt', bridgeType = 'arch') {
    if (!rawPoints || rawPoints.length < 2) return null;

    // Resample path smoothly every 0.9 units
    const pts = [];
    for (let i = 0; i < rawPoints.length - 1; i++) {
      const a = rawPoints[i];
      const b = rawPoints[i + 1];
      const dist = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(dist / 0.85));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pts.push({
          x: a.x + (b.x - a.x) * t,
          z: a.z + (b.z - a.z) * t
        });
      }
    }
    pts.push(rawPoints[rawPoints.length - 1]);

    const typeCode = roadType === 'stone' ? 2 : roadType === 'royal' ? 3 : 1;
    const widthRadius = roadType === 'royal' ? 1.25 : roadType === 'stone' ? 0.95 : 0.78;
    const meshes = [];

    // 1. Paint road onto terrain vertex mask
    for (const p of pts) {
      this.turntable.paintRoadMask(p.x, p.z, widthRadius, typeCode);
    }
    this.turntable.updateTerrainGeometry();

    // 2. Detect water crossings & build automatic bridges (물 위를 건너면 자동으로 홍예교/목교 생성)
    let waterStartIdx = -1;
    for (let i = 0; i < pts.length; i++) {
      const h = this.turntable.getHeightAt(pts[i].x, pts[i].z);
      const inWater = h < WATER_LEVEL + 0.06;

      if (inWater && waterStartIdx === -1) {
        waterStartIdx = Math.max(0, i - 1);
      } else if (!inWater && waterStartIdx !== -1) {
        const pStart = pts[waterStartIdx];
        const pEnd = pts[i];
        if (Math.hypot(pEnd.x - pStart.x, pEnd.z - pStart.z) > 1.2) {
          const bridge = createBridge(pStart, pEnd, this.mats, bridgeType);
          this.roadsGroup.add(bridge);
          meshes.push({ mesh: bridge, x: (pStart.x + pEnd.x) * 0.5, z: (pStart.z + pEnd.z) * 0.5 });
        }
        waterStartIdx = -1;
      } else if (!inWater) {
        // Place decorative paving stones (박석) or slope stairs (돌계단)
        const slope = this.turntable.getSlopeAt(pts[i].x, pts[i].z);
        if (slope > 0.16 && i < pts.length - 1) {
          const next = pts[i + 1];
          const stepMesh = new THREE.Mesh(
            new THREE.BoxGeometry(widthRadius * 1.2, 0.14, 0.55),
            this.mats.stoneMat
          );
          stepMesh.position.set(pts[i].x, h + 0.05, pts[i].z);
          stepMesh.rotation.y = Math.atan2(next.x - pts[i].x, next.z - pts[i].z);
          stepMesh.receiveShadow = true;
          this.roadsGroup.add(stepMesh);
          meshes.push({ mesh: stepMesh, x: pts[i].x, z: pts[i].z });
        } else if (roadType !== 'dirt' && i % 2 === 0 && i < pts.length - 1) {
          const next = pts[i + 1];
          const paver = new THREE.Mesh(
            new THREE.BoxGeometry(widthRadius * 1.05, 0.06, 0.65),
            roadType === 'royal' ? this.mats.plasterMat : this.mats.stoneMat
          );
          paver.position.set(pts[i].x, h + 0.03, pts[i].z);
          paver.rotation.y = Math.atan2(next.x - pts[i].x, next.z - pts[i].z);
          paver.receiveShadow = true;
          this.roadsGroup.add(paver);
          meshes.push({ mesh: paver, x: pts[i].x, z: pts[i].z });
        }
      }
    }

    // If path ended while still in water, bridge to the last point
    if (waterStartIdx !== -1 && pts.length - 1 > waterStartIdx) {
      const pStart = pts[waterStartIdx];
      const pEnd = pts[pts.length - 1];
      if (Math.hypot(pEnd.x - pStart.x, pEnd.z - pStart.z) > 1.2) {
        const bridge = createBridge(pStart, pEnd, this.mats, bridgeType);
        this.roadsGroup.add(bridge);
        meshes.push({ mesh: bridge, x: (pStart.x + pEnd.x) * 0.5, z: (pStart.z + pEnd.z) * 0.5 });
      }
    }

    const rec = { points: pts, roadType, bridgeType, meshes };
    this.roads.push(rec);
    return rec;
  }

  eraseAt(x, z, radius) {
    this.turntable.paintRoadMask(x, z, radius, 0);
    this.turntable.updateTerrainGeometry();

    for (const road of this.roads) {
      for (let i = road.meshes.length - 1; i >= 0; i--) {
        const m = road.meshes[i];
        if (Math.hypot(m.x - x, m.z - z) <= radius + 1.0) {
          this.roadsGroup.remove(m.mesh);
          road.meshes.splice(i, 1);
        }
      }
    }
  }

  clearAll() {
    while (this.roadsGroup.children.length > 0) {
      this.roadsGroup.remove(this.roadsGroup.children[0]);
    }
    this.roads = [];
    this.turntable.roadMask.fill(0);
    this.turntable.updateTerrainGeometry();
  }
}
