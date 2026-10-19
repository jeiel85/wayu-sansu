import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Turntable, WATER_LEVEL } from './world/Turntable.js';
import { MaterialBank, createLandmark } from './world/ProceduralModels.js';
import { ZoneSystem, ZONE_TYPE_LABELS } from './world/ZoneSystem.js';
import { RoadSystem } from './world/RoadSystem.js';
import { LifeAndWeather } from './world/LifeAndWeather.js';
import { InkRenderer } from './world/InkRenderer.js';
import { GuGakAudio } from './audio/GuGakAudio.js';

const ZONE_COLORS = {
  giwa: '#3b4652',
  choga: '#c89d54',
  palace: '#8e3528',
  paddy: '#76964c',
  forest: '#2e5a3c',
  temple: '#b56333',
  dock: '#4b7888',
  market: '#b84830'
};

const POEM_LINES = {
  spring: '매화 향기 강바람에 실리고 봄빛이 기와 마루에 내려앉네',
  summer: '강산을 빚고 붓으로 터를 두르니 푸른 녹음 속 마을이 피어나네',
  autumn: '단풍은 붉게 물들고 황금빛 다랑논에 풍년가가 울려 퍼지네',
  winter: '백설이 고요히 내려앉은 산수간에 호롱불 온기가 은은하구나'
};

class DioramaApp {
  constructor() {
    this.canvas = document.getElementById('cv');
    this.inkCanvas = document.getElementById('inkLayer');
    this.labelsContainer = document.getElementById('labels');

    // App State
    this.activeTool = 'zone'; // 'zone' | 'terrain' | 'road' | 'landmark' | 'erase' | 'hand'
    this.zoneType = 'giwa';
    this.zoneDensity = 1.0;
    this.zoneWalls = true;

    this.terrainMode = 'raise';
    this.brushSize = 4.5;
    this.brushStrength = 0.7;

    this.roadType = 'dirt';
    this.bridgeType = 'arch';

    this.landmarkType = 'gyeonghoeru';
    this.landmarkRotation = 0;

    this.eraseSize = 3.5;

    this.season = 'summer';
    this.timeOfDay = 'day';
    this.weather = 'clear';
    this.sheetTheme = 'hanji';
    this.autoRotate = false;
    this.spacePressed = false;

    // Drawing state
    this.isDrawing = false;
    this.strokePoints = [];
    this.landmarkGhost = null;

    // History for Undo & Timelapse
    this.actionHistory = [];

    this.initScene();
    this.initSystems();
    this.bindUI();
    this.bindPointerEvents();

    // Load default scenic preset: Andong Hahoe Village
    this.loadPreset('andong', false);
    this.showToast('와유산수(臥遊山水) 화첩을 펼쳤습니다. 땅 위에 붓으로 구역을 그려보세요!');

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xebe0c5);
    this.scene.fog = new THREE.FogExp2(0xebe0c5, 0.0045);

    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 1, 350);
    this.camera.position.set(0, 42, 58);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 0.5, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minPolarAngle = 0.18;
    this.controls.minDistance = 16;
    this.controls.maxDistance = 115;
    // Left mouse is used for drawing unless in 'hand' mode; Right mouse orbits
    this.updateOrbitMouseButtons();

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0xfff8e7, 0x7c6a53, 0.92);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff0d4, 1.45);
    this.sunLight.position.set(36, 52, 28);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 160;
    const d = 48;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
  }

  initSystems() {
    this.audio = new GuGakAudio();
    this.mats = new MaterialBank();
    this.turntable = new Turntable(this.scene);
    this.zoneSystem = new ZoneSystem(this.turntable, this.mats, this.audio, this.labelsContainer);
    this.roadSystem = new RoadSystem(this.turntable, this.mats);
    this.lifeWeather = new LifeAndWeather(this.turntable, this.zoneSystem, this.roadSystem);
    this.inkRenderer = new InkRenderer(this.inkCanvas, this.turntable);

    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();

    this.updateLandmarkGhost();
  }

  updateOrbitMouseButtons() {
    if (!this.controls) return;
    if (this.activeTool === 'hand' || this.spacePressed) {
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
    } else {
      this.controls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE
      };
    }
  }

  updateLandmarkGhost() {
    if (this.landmarkGhost) {
      this.turntable.group.remove(this.landmarkGhost);
      this.landmarkGhost = null;
    }
    if (this.activeTool === 'landmark') {
      this.landmarkGhost = createLandmark(this.landmarkType, this.mats);
      this.landmarkGhost.rotation.y = this.landmarkRotation;
      this.landmarkGhost.visible = false;
      this.turntable.group.add(this.landmarkGhost);
    }
  }

  applyAtmosphereLighting() {
    this.mats.updateAtmosphere(this.season, this.timeOfDay);
    this.turntable.setConfig({ season: this.season });
    this.lifeWeather.setTimeOfDay(this.timeOfDay);

    const poemEl = document.getElementById('poemLine');
    if (poemEl && POEM_LINES[this.season]) {
      poemEl.textContent = POEM_LINES[this.season];
    }

    // Background & Lighting by Sheet + Time of Day
    let bgHex = 0xebe0c5;
    if (this.sheetTheme === 'silk') bgHex = 0xf3ece0;
    else if (this.sheetTheme === 'ink') bgHex = 0x23272e;

    if (this.timeOfDay === 'dawn') {
      this.sunLight.color.setHex(0xffd7b5);
      this.sunLight.intensity = 1.05;
      this.sunLight.position.set(45, 24, -25);
      this.hemiLight.color.setHex(0xdce6f2);
      this.hemiLight.groundColor.setHex(0x6e6259);
      this.hemiLight.intensity = 0.85;
      if (this.sheetTheme !== 'ink') bgHex = 0xe2dcd0;
    } else if (this.timeOfDay === 'day') {
      this.sunLight.color.setHex(0xfff2d6);
      this.sunLight.intensity = 1.48;
      this.sunLight.position.set(34, 54, 28);
      this.hemiLight.color.setHex(0xfff8e7);
      this.hemiLight.groundColor.setHex(0x7c6a53);
      this.hemiLight.intensity = 0.92;
    } else if (this.timeOfDay === 'sunset') {
      this.sunLight.color.setHex(0xff8e52);
      this.sunLight.intensity = 1.35;
      this.sunLight.position.set(-46, 22, 30);
      this.hemiLight.color.setHex(0xf7bfa0);
      this.hemiLight.groundColor.setHex(0x593e38);
      this.hemiLight.intensity = 0.78;
      if (this.sheetTheme !== 'ink') bgHex = 0xe6cfb8;
    } else if (this.timeOfDay === 'night') {
      this.sunLight.color.setHex(0x88a8d8);
      this.sunLight.intensity = 0.58;
      this.sunLight.position.set(-28, 48, -30);
      this.hemiLight.color.setHex(0x4b6285);
      this.hemiLight.groundColor.setHex(0x22262e);
      this.hemiLight.intensity = 0.52;
      if (this.sheetTheme !== 'ink') bgHex = 0x2a303c;
    }

    this.scene.background.setHex(bgHex);
    this.scene.fog.color.setHex(bgHex);
    this.scene.fog.density = (this.weather === 'mist' || this.timeOfDay === 'dawn') ? 0.0085 : 0.004;
  }

  raycastTerrain(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const targets = [this.turntable.terrainMesh];
    if (this.turntable.waterMesh && this.turntable.waterEnabled) {
      targets.push(this.turntable.waterMesh);
    }

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      // Convert hit point into turntable local space (in case turntable is auto-rotated)
      const localPt = this.turntable.group.worldToLocal(hits[0].point.clone());
      return localPt;
    }
    return null;
  }

  bindPointerEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.inkRenderer.resize();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.spacePressed) {
        this.spacePressed = true;
        this.updateOrbitMouseButtons();
      } else if (e.key === 'Escape') {
        const menu = document.getElementById('menuOverlay');
        if (menu) menu.hidden = !menu.hidden;
      } else if (e.key === 'r' || e.key === 'R') {
        this.rotateLandmark();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undoLastAction();
      } else if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const map = { '1': 'zone', '2': 'terrain', '3': 'road', '4': 'landmark', '5': 'erase', '6': 'hand' };
        this.selectTool(map[e.key]);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spacePressed = false;
        this.updateOrbitMouseButtons();
      }
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.activeTool === 'hand' || this.spacePressed) return;
      const pt = this.raycastTerrain(e.clientX, e.clientY);
      if (!pt) return;

      this.isDrawing = true;
      this.strokePoints = [{ x: pt.x, z: pt.z }];

      if (this.activeTool === 'terrain') {
        this.turntable.sculpt(pt.x, pt.z, this.terrainMode, this.brushSize, this.brushStrength);
        this.zoneSystem.syncHeightsToTerrain();
      } else if (this.activeTool === 'landmark') {
        const clamped = this.turntable.clampToPlot(pt.x, pt.z, 1.5);
        const rec = this.zoneSystem.placeLandmark(this.landmarkType, clamped.x, clamped.z, this.landmarkRotation);
        if (rec) {
          this.actionHistory.push({
            kind: 'landmark',
            type: this.landmarkType,
            x: clamped.x,
            z: clamped.z,
            rotY: this.landmarkRotation,
            ref: rec
          });
          this.audio.playSprout(2);
          this.updateStatsUI();
        }
        this.isDrawing = false;
      } else if (this.activeTool === 'erase') {
        this.performErase(pt.x, pt.z);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const pt = this.raycastTerrain(e.clientX, e.clientY);
      if (!pt) {
        this.turntable.updateBrushCursor(null, 1, false);
        if (this.landmarkGhost) this.landmarkGhost.visible = false;
        return;
      }

      // Update brush cursor or landmark preview
      if (this.activeTool === 'terrain') {
        this.turntable.updateBrushCursor(pt, this.brushSize, true);
      } else if (this.activeTool === 'erase') {
        this.turntable.updateBrushCursor(pt, this.eraseSize, true);
      } else if (this.activeTool === 'zone' || this.activeTool === 'road') {
        this.turntable.updateBrushCursor(pt, 0.65, true);
      } else {
        this.turntable.updateBrushCursor(null, 1, false);
      }

      if (this.activeTool === 'landmark' && this.landmarkGhost) {
        const clamped = this.turntable.clampToPlot(pt.x, pt.z, 1.5);
        const gy = Math.max(WATER_LEVEL, this.turntable.getHeightAt(clamped.x, clamped.z));
        this.landmarkGhost.position.set(clamped.x, gy, clamped.z);
        this.landmarkGhost.visible = true;
      }

      if (!this.isDrawing) return;

      if (this.activeTool === 'terrain') {
        this.turntable.sculpt(pt.x, pt.z, this.terrainMode, this.brushSize, this.brushStrength * 0.45);
        this.zoneSystem.syncHeightsToTerrain();
      } else if (this.activeTool === 'erase') {
        this.performErase(pt.x, pt.z);
      } else if (this.activeTool === 'zone' || this.activeTool === 'road') {
        const last = this.strokePoints[this.strokePoints.length - 1];
        const clamped = this.turntable.clampToPlot(pt.x, pt.z, 1.2);
        if (Math.hypot(clamped.x - last.x, clamped.z - last.z) > 0.65) {
          this.strokePoints.push(clamped);
        }
      }
    });

    const finishStroke = () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      if (this.activeTool === 'zone' && this.strokePoints.length >= 3) {
        const zone = this.zoneSystem.createZone(this.strokePoints, this.zoneType, {
          density: this.zoneDensity,
          buildWalls: this.zoneWalls
        });
        if (zone) {
          this.actionHistory.push({
            kind: 'zone',
            zoneType: this.zoneType,
            polygon: [...this.strokePoints],
            options: { density: this.zoneDensity, buildWalls: this.zoneWalls, name: zone.name },
            ref: zone
          });
          this.showToast(`'${zone.name}' (${ZONE_TYPE_LABELS[this.zoneType]}) 구역이 자라납니다.`);
          this.updateStatsUI();
        }
      } else if (this.activeTool === 'road' && this.strokePoints.length >= 2) {
        const road = this.roadSystem.addRoadPath(this.strokePoints, this.roadType, this.bridgeType);
        if (road) {
          this.actionHistory.push({
            kind: 'road',
            points: [...this.strokePoints],
            roadType: this.roadType,
            bridgeType: this.bridgeType,
            ref: road
          });
          this.audio.playSprout(4);
        }
      }

      this.strokePoints = [];
    };

    window.addEventListener('pointerup', finishStroke);
  }

  performErase(x, z) {
    const removed = this.zoneSystem.eraseAt(x, z, this.eraseSize);
    this.roadSystem.eraseAt(x, z, this.eraseSize);
    if (removed > 0) {
      this.updateStatsUI();
    }
  }

  selectTool(toolName) {
    this.activeTool = toolName;
    document.body.dataset.activeTool = toolName;

    document.querySelectorAll('.tools .tool[data-tool]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.tool === toolName ? 'true' : 'false');
    });

    document.querySelectorAll('#toolPanel [data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== toolName;
    });

    this.turntable.updateBrushCursor(null, 1, false);
    this.updateLandmarkGhost();
    this.updateOrbitMouseButtons();
  }

  rotateLandmark() {
    this.landmarkRotation = (this.landmarkRotation + Math.PI / 4) % (Math.PI * 2);
    if (this.landmarkGhost) {
      this.landmarkGhost.rotation.y = this.landmarkRotation;
    }
  }

  undoLastAction() {
    if (this.actionHistory.length === 0) {
      this.showToast('더 이상 되돌릴 기록이 없습니다.');
      return;
    }
    const last = this.actionHistory.pop();
    if (last.kind === 'zone' && last.ref) {
      this.zoneSystem.zonesGroup.remove(last.ref.group);
      if (last.ref.labelEl) last.ref.labelEl.remove();
      const idx = this.zoneSystem.zones.indexOf(last.ref);
      if (idx !== -1) this.zoneSystem.zones.splice(idx, 1);
      this.showToast(`'${last.ref.name}' 구역을 되돌렸습니다.`);
    } else if (last.kind === 'landmark' && last.ref) {
      this.zoneSystem.zonesGroup.remove(last.ref.mesh);
      const idx = this.zoneSystem.landmarks.indexOf(last.ref);
      if (idx !== -1) this.zoneSystem.landmarks.splice(idx, 1);
      this.showToast('명소 배치를 되돌렸습니다.');
    } else if (last.kind === 'road' && last.ref) {
      for (const m of last.ref.meshes) {
        this.roadSystem.roadsGroup.remove(m.mesh);
      }
      const idx = this.roadSystem.roads.indexOf(last.ref);
      if (idx !== -1) this.roadSystem.roads.splice(idx, 1);
      this.showToast('길 놓기를 되돌렸습니다.');
    }
    this.updateStatsUI();
  }

  // Timelapse Replay: Clear and replay all recorded actions step by step!
  playTimelapse() {
    if (this.actionHistory.length === 0) {
      this.showToast('재생할 화첩 기록이 없습니다.');
      return;
    }
    const savedActions = [...this.actionHistory];
    this.zoneSystem.clearAll();
    this.roadSystem.clearAll();
    this.actionHistory = [];
    this.updateStatsUI();
    this.showToast('화첩 타임랩스를 재생합니다...');

    savedActions.forEach((act, idx) => {
      setTimeout(() => {
        if (act.kind === 'zone') {
          const z = this.zoneSystem.createZone(act.polygon, act.zoneType, act.options);
          if (z) {
            act.ref = z;
            this.actionHistory.push(act);
          }
        } else if (act.kind === 'road') {
          const r = this.roadSystem.addRoadPath(act.points, act.roadType, act.bridgeType);
          if (r) {
            act.ref = r;
            this.actionHistory.push(act);
          }
        } else if (act.kind === 'landmark') {
          const lm = this.zoneSystem.placeLandmark(act.type, act.x, act.z, act.rotY);
          if (lm) {
            act.ref = lm;
            this.actionHistory.push(act);
          }
        }
        this.updateStatsUI();
      }, idx * 650);
    });
  }

  // Helper to generate circular/oval polygon for presets
  makeOvalPoly(cx, cz, rx, rz, points = 12) {
    const arr = [];
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      arr.push({
        x: cx + Math.cos(a) * rx,
        z: cz + Math.sin(a) * rz
      });
    }
    return arr;
  }

  // Load curated Korean landscape & village presets
  loadPreset(presetKey = 'andong', notify = true) {
    this.zoneSystem.clearAll();
    this.roadSystem.clearAll();
    this.actionHistory = [];

    this.turntable.generateLandscape(presetKey);

    const addZ = (poly, type, opts = {}) => {
      const z = this.zoneSystem.createZone(poly, type, opts);
      if (z) {
        this.actionHistory.push({ kind: 'zone', zoneType: type, polygon: poly, options: { ...opts, name: z.name }, ref: z });
      }
    };
    const addR = (pts, rType = 'dirt', bType = 'arch') => {
      const r = this.roadSystem.addRoadPath(pts, rType, bType);
      if (r) {
        this.actionHistory.push({ kind: 'road', points: pts, roadType: rType, bridgeType: bType, ref: r });
      }
    };
    const addL = (type, x, z, rotY = 0) => {
      const lm = this.zoneSystem.placeLandmark(type, x, z, rotY);
      if (lm) {
        this.actionHistory.push({ kind: 'landmark', type, x, z, rotY, ref: lm });
      }
    };

    const titleMap = {
      andong: '하회청풍도 (河回淸風圖)',
      palace: '북악산성행궁도 (北岳山城行宮圖)',
      temple: '심산청량사도 (深山淸凉寺圖)',
      port: '마포황포귀범도 (麻浦黃布歸帆圖)'
    };
    const stampTitleEl = document.getElementById('stampTitle');
    if (stampTitleEl && titleMap[presetKey]) {
      stampTitleEl.textContent = titleMap[presetKey];
    }

    if (presetKey === 'andong') {
      // 1. Central Noble Giwa Village (양반 기와촌)
      addZ(this.makeOvalPoly(-1.5, 10.2, 9.2, 6.0), 'giwa', { density: 1.25, buildWalls: true, name: '하회 양반촌' });
      // 2. Cozy Choga Village (초가 민가촌)
      addZ(this.makeOvalPoly(12.0, 5.5, 6.8, 5.4), 'choga', { density: 1.15, buildWalls: true, name: '아랫말 초가촌' });
      // 3. Buyongdae Pine Forest on NW cliff (부용대 송림)
      addZ(this.makeOvalPoly(-12.5, -13.0, 8.8, 7.2), 'forest', { density: 1.25, buildWalls: false, name: '부용대 적송림' });
      // 4. Paddy fields on SW meadow (풍년 다랑논)
      addZ(this.makeOvalPoly(-15.5, 6.5, 6.5, 5.5), 'paddy', { density: 1.1, buildWalls: false, name: '풍년 수리답' });
      // 5. Riverside Ferry Dock (나루터와 황포돛배)
      addZ(this.makeOvalPoly(4.5, -2.5, 7.0, 4.8), 'dock', { density: 1.1, buildWalls: false, name: '나루터 포구' });
      // 6. Road crossing river with arched stone bridge (홍예교와 고을길)
      addR([
        { x: -10, z: 9 },
        { x: -2, z: 7 },
        { x: -1, z: -2 },
        { x: -2, z: -9 },
        { x: -8, z: -13 }
      ], 'stone', 'arch');
      // 7. Scenic Pavilion on cliff & Dangsan tree
      addL('pavilion', -8.5, -10.5, 0.4);
      addL('sacredtree', 6.5, 10.0, 0);
    } else if (presetKey === 'palace') {
      addZ(this.makeOvalPoly(0, -2, 11.5, 8.5), 'palace', { density: 1.0, buildWalls: true, name: '북악 산성 행궁' });
      addZ(this.makeOvalPoly(-15, -6, 7.5, 8.0), 'forest', { density: 1.2, buildWalls: false, name: '좌청룡 송림' });
      addZ(this.makeOvalPoly(15, -6, 7.5, 8.0), 'forest', { density: 1.2, buildWalls: false, name: '우백호 죽림' });
      addZ(this.makeOvalPoly(-10, 10, 7.2, 4.8), 'giwa', { density: 1.0, buildWalls: true, name: '북촌 양반가' });
      addZ(this.makeOvalPoly(10, 10, 7.2, 4.8), 'market', { density: 1.1, buildWalls: false, name: '운종가 시전행랑' });
      addR([
        { x: 0, z: -2 },
        { x: 0, z: 8 },
        { x: 0, z: 20 }
      ], 'royal', 'arch');
      addL('hongsalmun', 0, 8.2, 0);
      addL('beacon', -2, -16, 0);
    } else if (presetKey === 'temple') {
      addZ(this.makeOvalPoly(-10, 3, 8.5, 6.8), 'temple', { density: 1.05, buildWalls: true, name: '청량산 고찰' });
      addZ(this.makeOvalPoly(12, -4, 9.5, 11.0), 'forest', { density: 1.3, buildWalls: false, name: '비경 대나무숲' });
      addZ(this.makeOvalPoly(-11, -12, 8.0, 6.5), 'forest', { density: 1.2, buildWalls: false, name: '만년 적송림' });
      addZ(this.makeOvalPoly(9, 13, 6.5, 5.2), 'paddy', { density: 1.0, buildWalls: false, name: '산자락 다랑논' });
      addR([
        { x: -10, z: 8 },
        { x: -2, z: 6 },
        { x: 5, z: 4 },
        { x: 11, z: 0 }
      ], 'stone', 'wood');
      addL('hongsalmun', -4.2, 6.8, 1.2);
      addL('pavilion', 9.5, -11.5, -0.5);
      addL('watermill', 2.8, 9.5, 0.3);
    } else if (presetKey === 'port') {
      addZ(this.makeOvalPoly(0, 6, 13.0, 6.5), 'dock', { density: 1.2, buildWalls: false, name: '황포돛배 나루터' });
      addZ(this.makeOvalPoly(-10, -4, 7.8, 5.5), 'market', { density: 1.2, buildWalls: false, name: '포구 오일장터' });
      addZ(this.makeOvalPoly(9, -5, 8.2, 5.8), 'giwa', { density: 1.05, buildWalls: true, name: '해안 기와촌' });
      addZ(this.makeOvalPoly(12, 16, 5.2, 4.5), 'forest', { density: 1.2, buildWalls: false, name: '학도(鶴島) 솔섬' });
      addL('pavilion', 12, 16, 0);
      addL('sacredtree', -1, -7, 0);
    }

    this.updateStatsUI();
    if (notify) {
      this.showToast(`'${titleMap[presetKey] || '산수 초본'}' 화폭을 불러왔습니다.`);
    }
  }

  updateStatsUI() {
    const s = this.zoneSystem.getStats();
    const bEl = document.getElementById('statBuildings');
    const tEl = document.getElementById('statTrees');
    const pEl = document.getElementById('statPop');
    const zEl = document.getElementById('statZones');

    if (bEl) bEl.textContent = `${s.buildings}채`;
    if (tEl) tEl.textContent = `${s.trees}그루`;
    if (pEl) pEl.textContent = `${s.pop}명`;
    if (zEl) zEl.textContent = `${s.zones}곳`;
  }

  showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.removeAttribute('data-off');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.setAttribute('data-off', '');
    }, 3200);
  }

  exportPostcardPNG() {
    this.renderer.render(this.scene, this.camera);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const ctx = outCanvas.getContext('2d');

    // Draw 3D scene
    ctx.drawImage(this.canvas, 0, 0);
    // Draw Ink overlay
    ctx.drawImage(this.inkCanvas, 0, 0, w, h);

    // Draw Traditional Frame & Title Stamp onto exported postcard
    const pad = Math.round(w * 0.018);
    ctx.strokeStyle = '#241911';
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

    ctx.font = `bold ${Math.round(h * 0.036)}px "Nanum Myeongjo", serif`;
    ctx.fillStyle = '#241911';
    ctx.fillText('臥遊山水 · 와유산수', pad * 2.2, pad * 3.2);

    // Red Seal (낙관)
    ctx.fillStyle = '#a62c22';
    ctx.fillRect(pad * 2.2, pad * 3.6, 54, 24);
    ctx.fillStyle = '#f9f1e1';
    ctx.font = 'bold 14px serif';
    ctx.fillText('臥遊印', pad * 2.2 + 6, pad * 3.6 + 17);

    const url = outCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `와유산수_화첩엽서_${Date.now()}.png`;
    a.click();
    this.showToast('화첩 엽서(PNG)를 갈무리하여 저장했습니다!');
  }

  saveWorldJSON() {
    const data = {
      version: 1,
      shape: this.turntable.shape,
      sizeKey: this.turntable.sizeKey,
      season: this.season,
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      heights: Array.from(this.turntable.heights),
      rockiness: Array.from(this.turntable.rockiness),
      actions: this.actionHistory.map((a) => ({
        kind: a.kind,
        zoneType: a.zoneType,
        polygon: a.polygon,
        options: a.options,
        points: a.points,
        roadType: a.roadType,
        bridgeType: a.bridgeType,
        type: a.type,
        x: a.x,
        z: a.z,
        rotY: a.rotY
      }))
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `와유산수_화첩기록_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('화첩 파일(.json)을 저장했습니다.');
  }

  loadWorldJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        this.zoneSystem.clearAll();
        this.roadSystem.clearAll();
        this.actionHistory = [];

        this.turntable.setConfig({ shape: data.shape || 'round', sizeKey: data.sizeKey || 'medium' });
        if (data.heights && data.heights.length === this.turntable.heights.length) {
          this.turntable.heights.set(data.heights);
        }
        if (data.rockiness && data.rockiness.length === this.turntable.rockiness.length) {
          this.turntable.rockiness.set(data.rockiness);
        }
        this.turntable.updateTerrainGeometry();

        if (Array.isArray(data.actions)) {
          for (const act of data.actions) {
            if (act.kind === 'zone') {
              const z = this.zoneSystem.createZone(act.polygon, act.zoneType, act.options);
              if (z) this.actionHistory.push({ ...act, ref: z });
            } else if (act.kind === 'road') {
              const r = this.roadSystem.addRoadPath(act.points, act.roadType, act.bridgeType);
              if (r) this.actionHistory.push({ ...act, ref: r });
            } else if (act.kind === 'landmark') {
              const lm = this.zoneSystem.placeLandmark(act.type, act.x, act.z, act.rotY);
              if (lm) this.actionHistory.push({ ...act, ref: lm });
            }
          }
        }
        this.updateStatsUI();
        this.showToast('화첩 파일을 성공적으로 불러왔습니다!');
      } catch (err) {
        this.showToast('화첩 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  }

  bindUI() {
    // 1. Left Tool Selection
    document.querySelectorAll('.tools .tool[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => this.selectTool(btn.dataset.tool));
    });

    // Helper for segmented buttons
    const bindSegmented = (containerId, attrName, callback) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.querySelectorAll(`button[${attrName}]`).forEach((btn) => {
        btn.addEventListener('click', () => {
          container.querySelectorAll(`button[${attrName}]`).forEach((b) => {
            b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
          });
          callback(btn.getAttribute(attrName), btn);
        });
      });
    };

    // Zone UI
    bindSegmented('zoneTypes', 'data-zone', (val, btn) => {
      this.zoneType = val;
      const out = document.getElementById('zoneNameOut');
      if (out) out.textContent = btn.querySelector('span')?.textContent || val;
    });

    bindSegmented('zoneDensity', 'data-density', (val, btn) => {
      this.zoneDensity = parseFloat(val);
      const out = document.getElementById('zoneDensityOut');
      if (out) out.textContent = btn.textContent;
    });

    document.getElementById('zoneWallChk')?.addEventListener('change', (e) => {
      this.zoneWalls = e.target.checked;
    });

    // Terrain UI
    bindSegmented('terrainModes', 'data-tmode', (val) => {
      this.terrainMode = val;
    });

    const brushSizeInput = document.getElementById('brushSize');
    brushSizeInput?.addEventListener('input', (e) => {
      this.brushSize = parseFloat(e.target.value);
      const out = document.getElementById('brushSizeOut');
      if (out) out.textContent = `${this.brushSize}칸`;
    });

    const brushStrengthInput = document.getElementById('brushStrength');
    brushStrengthInput?.addEventListener('input', (e) => {
      this.brushStrength = parseFloat(e.target.value);
      const out = document.getElementById('brushStrengthOut');
      if (out) {
        out.textContent = this.brushStrength < 0.5 ? '은은하게' : this.brushStrength > 1.0 ? '강하게' : '보통';
      }
    });

    document.getElementById('genSansuBtn')?.addEventListener('click', () => {
      const presets = ['andong', 'palace', 'temple', 'port'];
      const pick = presets[Math.floor(Math.random() * presets.length)];
      this.turntable.generateLandscape(pick);
      this.zoneSystem.syncHeightsToTerrain();
      this.showToast('새로운 산수 지형을 빚었습니다.');
    });

    document.getElementById('flatWorldBtn')?.addEventListener('click', () => {
      this.turntable.generateLandscape('flat');
      this.zoneSystem.syncHeightsToTerrain();
      this.showToast('지형을 너른 평야로 골랐습니다.');
    });

    // Road UI
    bindSegmented('roadTypes', 'data-rtype', (val) => {
      this.roadType = val;
    });
    bindSegmented('bridgeTypes', 'data-btype', (val) => {
      this.bridgeType = val;
    });

    // Landmark UI
    bindSegmented('landmarkList', 'data-lm', (val) => {
      this.landmarkType = val;
      this.updateLandmarkGhost();
    });
    document.getElementById('rotLandmarkBtn')?.addEventListener('click', () => {
      this.rotateLandmark();
    });

    // Erase UI
    document.getElementById('eraseSize')?.addEventListener('input', (e) => {
      this.eraseSize = parseFloat(e.target.value);
      const out = document.getElementById('eraseSizeOut');
      if (out) out.textContent = `${this.eraseSize}칸`;
    });

    document.getElementById('clearBuildingsBtn')?.addEventListener('click', () => {
      this.zoneSystem.clearAll();
      this.roadSystem.clearAll();
      this.actionHistory = [];
      this.updateStatsUI();
      this.showToast('모든 건물과 길을 비웠습니다.');
    });

    // Camera / Hand UI
    document.getElementById('resetCamBtn')?.addEventListener('click', () => {
      this.camera.position.set(0, 42, 58);
      this.controls.target.set(0, 0.5, 0);
      this.turntable.group.rotation.y = 0;
    });

    const autoRotBtn = document.getElementById('toggleAutoRotBtn');
    autoRotBtn?.addEventListener('click', () => {
      this.autoRotate = !this.autoRotate;
      autoRotBtn.setAttribute('aria-pressed', this.autoRotate ? 'true' : 'false');
    });

    document.getElementById('postcardBtn')?.addEventListener('click', () => this.exportPostcardPNG());
    document.getElementById('undoBtn')?.addEventListener('click', () => this.undoLastAction());
    document.getElementById('timelapseBtn')?.addEventListener('click', () => this.playTimelapse());

    // Right Environment Panel
    bindSegmented('seasons', 'data-season', (val) => {
      this.season = val;
      this.applyAtmosphereLighting();
    });

    bindSegmented('daytimes', 'data-time', (val) => {
      this.timeOfDay = val;
      this.applyAtmosphereLighting();
    });

    bindSegmented('weathers', 'data-weather', (val) => {
      this.weather = val;
      this.lifeWeather.setWeather(val);
      this.applyAtmosphereLighting();
    });

    bindSegmented('sheets', 'data-sheet', (val) => {
      this.sheetTheme = val;
      document.documentElement.dataset.sheet = val;
      this.applyAtmosphereLighting();
    });

    bindSegmented('worldShapes', 'data-shape', (val) => {
      this.turntable.setConfig({ shape: val });
      this.zoneSystem.syncHeightsToTerrain();
    });

    bindSegmented('worldSizes', 'data-size', (val) => {
      this.turntable.setConfig({ sizeKey: val });
      this.loadPreset('andong', false);
      this.showToast(`좌대 크기를 '${val.toUpperCase()}' 규격으로 변경했습니다.`);
    });

    document.getElementById('waterChk')?.addEventListener('change', (e) => {
      this.turntable.setConfig({ waterEnabled: e.target.checked });
    });

    document.getElementById('inkEdgeChk')?.addEventListener('change', (e) => {
      this.turntable.setConfig({ inkContours: e.target.checked });
    });

    document.getElementById('labelsChk')?.addEventListener('change', (e) => {
      this.zoneSystem.setLabelsVisible(e.target.checked);
    });

    document.getElementById('lifeChk')?.addEventListener('change', (e) => {
      this.lifeWeather.setLifeEnabled(e.target.checked);
    });

    document.getElementById('audioChk')?.addEventListener('change', (e) => {
      this.audio.setEnabled(e.target.checked);
      if (e.target.checked) {
        this.showToast('국악 가야금·풍경 자연음을 켰습니다.');
      }
    });

    // Menu Modal
    const menuOverlay = document.getElementById('menuOverlay');
    document.getElementById('openMenuBtn')?.addEventListener('click', () => {
      if (menuOverlay) menuOverlay.hidden = false;
    });
    document.getElementById('closeMenuBtn')?.addEventListener('click', () => {
      if (menuOverlay) menuOverlay.hidden = true;
    });

    document.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.loadPreset(btn.dataset.preset, true);
        if (menuOverlay) menuOverlay.hidden = true;
      });
    });

    document.getElementById('saveJsonBtn')?.addEventListener('click', () => this.saveWorldJSON());
    const loadInput = document.getElementById('loadJsonInput');
    document.getElementById('loadJsonBtn')?.addEventListener('click', () => loadInput?.click());
    loadInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.loadWorldJSON(file);
        if (menuOverlay) menuOverlay.hidden = true;
      }
    });

    document.getElementById('menuScreenshotBtn')?.addEventListener('click', () => {
      if (menuOverlay) menuOverlay.hidden = true;
      setTimeout(() => this.exportPostcardPNG(), 120);
    });

    document.getElementById('menuClearAllBtn')?.addEventListener('click', () => {
      this.zoneSystem.clearAll();
      this.roadSystem.clearAll();
      this.turntable.generateLandscape('flat');
      this.actionHistory = [];
      this.updateStatsUI();
      if (menuOverlay) menuOverlay.hidden = true;
      this.showToast('화폭을 깨끗한 백지로 초기화했습니다.');
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    if (this.autoRotate && !this.isDrawing) {
      this.turntable.group.rotation.y += dt * 0.18;
    }

    this.controls.update();
    this.turntable.animateWater(elapsed);
    this.zoneSystem.update(dt, elapsed, this.camera, window.innerWidth, window.innerHeight);
    this.lifeWeather.update(dt, elapsed);

    this.renderer.render(this.scene, this.camera);

    // Render 2D calligraphic brush stroke & Hanji vignette
    this.inkRenderer.render(
      this.camera,
      this.isDrawing ? this.strokePoints : null,
      this.activeTool,
      ZONE_COLORS[this.zoneType] || '#3b4652'
    );
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__dioramaApp = new DioramaApp();
});
