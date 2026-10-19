import * as THREE from 'three';

export class InkRenderer {
  constructor(inkCanvas, turntable) {
    this.canvas = inkCanvas;
    this.ctx = inkCanvas.getContext('2d');
    this.turntable = turntable;
    this.inkEnabled = true;

    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  projectPoint(x, y, z, camera) {
    const v = new THREE.Vector3(x, y, z);
    v.applyMatrix4(this.turntable.group.matrixWorld);
    v.project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      visible: v.z >= -1 && v.z <= 1
    };
  }

  render(camera, activeStrokePoints, strokeMode = 'zone', zoneColorHex = '#3b4652') {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // 1. Subtle Hanji paper vignette & ink-wash corners
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.32, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    grad.addColorStop(0, 'rgba(235, 224, 197, 0)');
    grad.addColorStop(1, 'rgba(65, 45, 25, 0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. If user is currently drawing a Zone or Road, render a Calligraphic Sumi-e Brush Stroke!
    if (activeStrokePoints && activeStrokePoints.length > 1) {
      const screenPts = [];
      for (const p of activeStrokePoints) {
        const py = Math.max(0, this.turntable.getHeightAt(p.x, p.z)) + 0.15;
        const sp = this.projectPoint(p.x, py, p.z, camera);
        if (sp.visible) screenPts.push(sp);
      }

      if (screenPts.length > 1) {
        ctx.save();
        if (strokeMode === 'zone') {
          // Fill translucent watercolor wash inside polygon
          ctx.beginPath();
          ctx.moveTo(screenPts[0].x, screenPts[0].y);
          for (let i = 1; i < screenPts.length; i++) {
            ctx.lineTo(screenPts[i].x, screenPts[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = zoneColorHex + '28';
          ctx.fill();

          // Dashed closing line from current point back to start
          const first = screenPts[0];
          const last = screenPts[screenPts.length - 1];
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(first.x, first.y);
          ctx.strokeStyle = 'rgba(166, 44, 34, 0.65)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Main calligraphic ink brush stroke (모필 묵선)
        for (let i = 1; i < screenPts.length; i++) {
          const p0 = screenPts[i - 1];
          const p1 = screenPts[i];
          const speed = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          const brushW = Math.max(2.2, Math.min(6.5, 5.8 - speed * 0.06));

          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = 'rgba(32, 22, 14, 0.86)';
          ctx.lineWidth = brushW;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
}
