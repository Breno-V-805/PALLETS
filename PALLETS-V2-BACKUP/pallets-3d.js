/**
 * PALLETS // Three.js 3D WebGL Studio Engine
 * Premium Clean Enterprise SaaS Minimalism · Frosted Glass (Glassmorphism)
 * 
 * 1. Global KPI Header 3D Isometric Mini-Icons
 * 2. Hero Frosted Glass Packaging & Neural Core
 * 3. Interactive Scenario Simulator 3D Isometric Bar Chart
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. GLOBAL FLOATING KPI HEADER 3D ISOMETRIC MINI-ICONS
  // =========================================================================

  class PalletsHeader3DIcons {
    constructor() {
      this.icons = [
        { id: 'kpi-3d-box', type: 'box', color: 0x2563eb },      // Active SKUs (Rounded Package)
        { id: 'kpi-3d-alert', type: 'alert', color: 0xef4444 },  // Predicted Stockouts (Hazard Diamond)
        { id: 'kpi-3d-stack', type: 'stack', color: 0xf59e0b },  // Excess Holding Cost (Coin Stack)
        { id: 'kpi-3d-ring', type: 'ring', color: 0x10b981 }     // Fill Rate (Neural Torus)
      ];

      this.instances = [];
      this.init();
    }

    init() {
      this.icons.forEach((item) => {
        const canvas = document.getElementById(item.id);
        if (!canvas) return;

        const width = 44;
        const height = 44;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        camera.position.set(2.8, 3.2, 2.8);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'low-power'
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Soft Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 2.2);
        scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(4, 6, 4);
        scene.add(dirLight);

        const rimLight = new THREE.DirectionalLight(item.color, 1.4);
        rimLight.position.set(-3, -2, -3);
        scene.add(rimLight);

        // Object Generation
        const group = new THREE.Group();

        // Premium Frosted Glass Material
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.18,
          metalness: 0.05,
          transmission: 0.9,
          thickness: 1.2,
          transparent: true,
          opacity: 0.92,
          clearcoat: 0.9
        });

        const edgeMat = new THREE.LineBasicMaterial({
          color: item.color,
          transparent: true,
          opacity: 0.65
        });

        if (item.type === 'box') {
          // Rounded Box Package
          const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
          const mesh = new THREE.Mesh(geo, glassMat);
          group.add(mesh);
          group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));

          // Soft blue inner cube
          const innerGeo = new THREE.BoxGeometry(0.65, 0.65, 0.65);
          const innerMat = new THREE.MeshStandardMaterial({
            color: 0x2563eb,
            roughness: 0.3,
            metalness: 0.1
          });
          group.add(new THREE.Mesh(innerGeo, innerMat));
        } else if (item.type === 'alert') {
          // Hazard Diamond / Octahedron
          const geo = new THREE.OctahedronGeometry(1.1, 0);
          const mesh = new THREE.Mesh(geo, glassMat);
          group.add(mesh);
          group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));

          // Soft pastel rose core
          const coreGeo = new THREE.SphereGeometry(0.38, 16, 16);
          const coreMat = new THREE.MeshStandardMaterial({
            color: 0xef4444,
            roughness: 0.2
          });
          group.add(new THREE.Mesh(coreGeo, coreMat));
        } else if (item.type === 'stack') {
          // 3 Rounded Stacked Discs
          const cylGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.22, 24);
          for (let i = -1; i <= 1; i++) {
            const disc = new THREE.Mesh(cylGeo, glassMat);
            disc.position.y = i * 0.35;
            group.add(disc);
            const discEdges = new THREE.LineSegments(new THREE.EdgesGeometry(cylGeo), edgeMat);
            disc.add(discEdges);
          }
          const coinCore = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16), new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            roughness: 0.2
          }));
          group.add(coinCore);
        } else if (item.type === 'ring') {
          // Smooth Torus Ring
          const torusGeo = new THREE.TorusGeometry(0.72, 0.22, 16, 32);
          const mesh = new THREE.Mesh(torusGeo, glassMat);
          mesh.rotation.x = Math.PI / 4;
          group.add(mesh);
          group.add(new THREE.LineSegments(new THREE.EdgesGeometry(torusGeo), edgeMat));

          const centerSphere = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.2
          }));
          group.add(centerSphere);
        }

        scene.add(group);

        this.instances.push({
          renderer: renderer,
          scene: scene,
          camera: camera,
          group: group,
          speed: item.type === 'alert' ? 0.025 : 0.015,
          type: item.type
        });
      });
    }

    render(time) {
      for (let i = 0; i < this.instances.length; i++) {
        const inst = this.instances[i];
        inst.group.rotation.y += inst.speed;
        inst.group.rotation.x = Math.sin(time * 1.5 + i) * 0.12;

        if (inst.type === 'alert') {
          const pulse = 1 + Math.sin(time * 3.5) * 0.08;
          inst.group.scale.set(pulse, pulse, pulse);
        }

        inst.renderer.render(inst.scene, inst.camera);
      }
    }
  }

  // =========================================================================
  // 2. HERO FROSTED GLASS PACKAGING & NEURAL CORE
  // =========================================================================

  class PalletsHeroPackaging3D {
    constructor() {
      this.canvas = document.getElementById('hero-3d-canvas');
      if (!this.canvas) return;

      this.container = this.canvas.parentElement;
      this.width = this.container.clientWidth || 480;
      this.height = this.container.clientHeight || 340;

      this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0, isDragging: false };

      this.init();
    }

    init() {
      this.scene = new THREE.Scene();
      this.scene.background = null;

      this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 1, 1000);
      this.camera.position.set(180, 140, 260);
      this.camera.lookAt(0, 15, 0);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true
      });
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;

      // Studio Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 2.4);
      this.scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(160, 240, 180);
      this.scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xbfdbfe, 1.8);
      rimLight.position.set(-150, -60, -100);
      this.scene.add(rimLight);

      // Root Group
      this.heroGroup = new THREE.Group();
      this.heroGroup.position.set(0, -10, 0);
      this.scene.add(this.heroGroup);

      this.buildObjects();
      this.initListeners();
    }

    buildObjects() {
      // 1. Frosted Glass Material
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.16,
        metalness: 0.02,
        transmission: 0.92,
        thickness: 1.8,
        ior: 1.48,
        transparent: true,
        opacity: 0.92,
        clearcoat: 0.9
      });

      const blueLineMat = new THREE.LineBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.55
      });

      // 2. Tetra-Pak Milk Carton
      const cartonGroup = new THREE.Group();
      cartonGroup.position.set(-42, 10, 0);

      const bodyGeo = new THREE.BoxGeometry(40, 75, 34);
      const body = new THREE.Mesh(bodyGeo, glassMat);
      cartonGroup.add(body);
      body.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), blueLineMat));

      const topGeo = new THREE.CylinderGeometry(0, 24, 20, 4, 1);
      topGeo.rotateY(Math.PI / 4);
      const topMesh = new THREE.Mesh(topGeo, glassMat);
      topMesh.position.y = 47.5;
      topMesh.scale.set(1.18, 1, 0.98);
      cartonGroup.add(topMesh);
      topMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(topGeo), blueLineMat));

      // Calming Blue Cap
      const capGeo = new THREE.CylinderGeometry(6, 6, 5, 20);
      const capMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.2 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(8, 55, 4);
      cap.rotation.z = -0.3;
      cartonGroup.add(cap);

      this.heroGroup.add(cartonGroup);
      this.carton = cartonGroup;

      // 3. Satin Beverage Can
      const canGroup = new THREE.Group();
      canGroup.position.set(48, -4, 20);

      const canGeo = new THREE.CylinderGeometry(17, 17, 72, 32);
      const canMat = new THREE.MeshPhysicalMaterial({
        color: 0xf1f5f9,
        roughness: 0.18,
        metalness: 0.2,
        transmission: 0.85,
        transparent: true,
        opacity: 0.9
      });
      const can = new THREE.Mesh(canGeo, canMat);
      canGroup.add(can);

      const rimGeo = new THREE.TorusGeometry(16, 1.2, 12, 32);
      rimGeo.rotateX(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8 }));
      rim.position.y = 36;
      canGroup.add(rim);

      this.heroGroup.add(canGroup);
      this.can = canGroup;

      // 4. Central Neural Predictive Diamond Core
      const coreGeo = new THREE.IcosahedronGeometry(24, 0);
      const coreMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.1,
        transmission: 0.95,
        thickness: 2.5,
        ior: 1.52,
        transparent: true,
        opacity: 0.95
      });
      this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
      this.coreMesh.position.set(0, 16, -15);

      const innerLight = new THREE.PointLight(0x3b82f6, 2.0, 90);
      this.coreMesh.add(innerLight);
      this.coreMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(coreGeo), blueLineMat));

      this.heroGroup.add(this.coreMesh);

      // 5. Staging Pallet Base (Light Wood / Architectural Slate)
      const palletMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      const palletGroup = new THREE.Group();
      palletGroup.position.set(0, -42, 0);

      for (let i = -40; i <= 40; i += 26) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(130, 5, 18), palletMat);
        slat.position.set(0, 0, i);
        palletGroup.add(slat);
      }
      for (let j = -50; j <= 50; j += 50) {
        const runner = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 105), palletMat);
        runner.position.set(j, -8, 0);
        palletGroup.add(runner);
      }
      this.heroGroup.add(palletGroup);
    }

    initListeners() {
      window.addEventListener('resize', () => {
        if (!this.container) return;
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
      });

      this.canvas.addEventListener('mousedown', (e) => {
        this.mouse.isDragging = true;
        this.mouse.lastX = e.clientX;
        this.mouse.lastY = e.clientY;
      });

      window.addEventListener('mouseup', () => {
        this.mouse.isDragging = false;
      });

      window.addEventListener('mousemove', (e) => {
        if (this.mouse.isDragging) {
          const deltaX = e.clientX - this.mouse.lastX;
          const deltaY = e.clientY - this.mouse.lastY;
          this.heroGroup.rotation.y += deltaX * 0.01;
          this.heroGroup.rotation.x += deltaY * 0.005;
          this.mouse.lastX = e.clientX;
          this.mouse.lastY = e.clientY;
        } else {
          const rect = this.canvas.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            this.mouse.targetX = ((e.clientX - rect.left) / this.width) * 2 - 1;
            this.mouse.targetY = -(((e.clientY - rect.top) / this.height) * 2 - 1);
          }
        }
      });
    }

    render(time) {
      if (!this.renderer) return;

      if (!this.mouse.isDragging) {
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

        this.heroGroup.rotation.y = time * 0.15 + this.mouse.x * 0.4;
        this.heroGroup.rotation.x = Math.sin(time * 0.2) * 0.05 + this.mouse.y * 0.2;
      }

      if (this.coreMesh) {
        this.coreMesh.rotation.y = -time * 0.4;
        this.coreMesh.rotation.z = time * 0.3;
        const pulse = 1 + Math.sin(time * 2.8) * 0.06;
        this.coreMesh.scale.set(pulse, pulse, pulse);
      }

      if (this.carton) {
        this.carton.rotation.y = time * 0.18;
      }

      if (this.can) {
        this.can.rotation.y = -time * 0.22;
      }

      this.renderer.render(this.scene, this.camera);
    }
  }

  // =========================================================================
  // 3. INTERACTIVE SCENARIO SIMULATOR: 3D FROSTED-GLASS ISOMETRIC BAR CHART
  // =========================================================================

  class PalletsSimulator3D {
    constructor() {
      this.canvas = document.getElementById('isometric-3d-canvas');
      if (!this.canvas) return;

      this.viewport = document.getElementById('isometric-chart-viewport');
      this.hoverCard = document.getElementById('isometric-hover-card');

      this.width = this.viewport.clientWidth || 720;
      this.height = this.viewport.clientHeight || 480;

      // 8 FMCG Product Categories modeled in the 3D isometric chart
      this.categories = [
        { code: 'DAIRY', name: 'Dairy & Plant Milks', baseUnits: 142, baseRunRate: 310, leadFactor: 1.2, weatherSensitivity: 0.8, promoSensitivity: 1.4 },
        { code: 'COLD',  name: 'Ready Cold Brews',     baseUnits: 86,  baseRunRate: 195, leadFactor: 1.0, weatherSensitivity: 1.6, promoSensitivity: 1.2 },
        { code: 'HOME',  name: 'Laundry & Home Care',   baseUnits: 280, baseRunRate: 110, leadFactor: 0.6, weatherSensitivity: 0.2, promoSensitivity: 0.9 },
        { code: 'GRAIN', name: 'Staples & Basmati',     baseUnits: 19,  baseRunRate: 85,  leadFactor: 1.4, weatherSensitivity: 0.4, promoSensitivity: 1.8 },
        { code: 'YOGU',  name: 'Greek Yogurts',         baseUnits: 38,  baseRunRate: 140, leadFactor: 1.5, weatherSensitivity: 1.1, promoSensitivity: 1.3 },
        { code: 'COND',  name: 'Gourmet Condiments',    baseUnits: 290, baseRunRate: 18,  leadFactor: 0.5, weatherSensitivity: 0.1, promoSensitivity: 0.7 },
        { code: 'ENRG',  name: 'Energy Beverages',      baseUnits: 24,  baseRunRate: 110, leadFactor: 1.2, weatherSensitivity: 1.4, promoSensitivity: 1.5 },
        { code: 'CONF',  name: 'Fine Confectionery',    baseUnits: 310, baseRunRate: 45,  leadFactor: 0.4, weatherSensitivity: 0.3, promoSensitivity: 1.6 }
      ];

      // Stress parameters (controlled by slider inputs)
      this.params = {
        weather: 0,     // -50 to +50
        discount: 15,   // 0% to 50%
        leadTime: 7     // 3 to 28 days
      };

      this.isAutoOrbit = false;
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2(-999, -999);
      this.hoveredBar = null;

      this.init();
    }

    init() {
      // 1. Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xf8fafc);
      this.scene.fog = new THREE.Fog(0xf8fafc, 400, 1200);

      // 2. Camera: Elevated Isometric View
      this.camera = new THREE.PerspectiveCamera(36, this.width / this.height, 1, 2000);
      this.defaultCameraPos = new THREE.Vector3(340, 420, 340);
      this.camera.position.copy(this.defaultCameraPos);
      this.lookAtTarget = new THREE.Vector3(0, 35, 0);
      this.camera.lookAt(this.lookAtTarget);

      // 3. Renderer with soft physical tone mapping
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // 4. Soft Studio Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 2.2);
      this.scene.add(ambient);

      // Warm Key Light
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
      keyLight.position.set(280, 450, 220);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 50;
      keyLight.shadow.camera.far = 1000;
      keyLight.shadow.camera.left = -250;
      keyLight.shadow.camera.right = 250;
      keyLight.shadow.camera.top = 250;
      keyLight.shadow.camera.bottom = -250;
      keyLight.shadow.bias = -0.001;
      this.scene.add(keyLight);

      // Soft Corporate Blue Rim Light (luminous frosted glass refraction)
      const rimLight = new THREE.DirectionalLight(0xbfdbfe, 1.8);
      rimLight.position.set(-250, 150, -250);
      this.scene.add(rimLight);

      // Ground Accent Fill
      const fillLight = new THREE.PointLight(0xdbeafe, 1.2, 800);
      fillLight.position.set(0, -30, 0);
      this.scene.add(fillLight);

      // 5. Build Architectural Ground Floor Grid
      this.buildGroundFloor();

      // 6. Build the 3D Frosted Glass Bars
      this.buildFrostedBars();

      // 7. Event Handlers
      this.initEvents();
    }

    buildGroundFloor() {
      // Soft Light Floor Plate
      const floorGeo = new THREE.PlaneGeometry(700, 700);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.8,
        metalness: 0.05
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1;
      floor.receiveShadow = true;
      this.scene.add(floor);

      // Delicate Architectural Grid
      const grid = new THREE.GridHelper(520, 26, 0xcbd5e1, 0xe2e8f0);
      grid.position.y = 0;
      this.scene.add(grid);
    }

    buildFrostedBars() {
      this.barsGroup = new THREE.Group();
      this.scene.add(this.barsGroup);

      this.barObjects = [];

      // Shared Frosted Glass Materials
      // 1. Critical Depletion (Pastel Rose)
      this.matCritical = new THREE.MeshPhysicalMaterial({
        color: 0xfca5a5,
        roughness: 0.18,
        metalness: 0.02,
        transmission: 0.88,
        thickness: 2.0,
        ior: 1.48,
        transparent: true,
        opacity: 0.94,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.28,
        clearcoat: 0.9
      });

      // 2. Optimal Healthy Buffer (Crisp Pearl White Glass)
      this.matHealthy = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.16,
        metalness: 0.03,
        transmission: 0.92,
        thickness: 2.2,
        ior: 1.48,
        transparent: true,
        opacity: 0.94,
        clearcoat: 1.0
      });

      // 3. Excess Surplus (Soft Warm Amber Glass)
      this.matOverstock = new THREE.MeshPhysicalMaterial({
        color: 0xfde047,
        roughness: 0.18,
        metalness: 0.02,
        transmission: 0.88,
        thickness: 2.0,
        ior: 1.48,
        transparent: true,
        opacity: 0.94,
        emissive: 0x78350f,
        emissiveIntensity: 0.25,
        clearcoat: 0.9
      });

      // Edge wireframes
      this.edgeMatCritical = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.6 });
      this.edgeMatHealthy = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.6 });
      this.edgeMatOverstock = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 });

      const barWidth = 32;
      const spacing = 52;
      const startX = -((this.categories.length - 1) * spacing) / 2;

      // Base geometry with origin at bottom for natural vertical scaling
      const baseGeo = new THREE.BoxGeometry(barWidth, 1, barWidth);
      baseGeo.translate(0, 0.5, 0);
      const edgeGeo = new THREE.EdgesGeometry(baseGeo);

      // Pedestal geometry
      const pedGeo = new THREE.BoxGeometry(barWidth + 10, 4, barWidth + 10);
      const pedMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.1
      });

      this.categories.forEach((cat, index) => {
        const posX = startX + index * spacing;
        const posZ = 0;

        const container = new THREE.Group();
        container.position.set(posX, 0, posZ);

        // 1. Pedestal Base
        const pedestal = new THREE.Mesh(pedGeo, pedMat);
        pedestal.position.y = 2;
        pedestal.receiveShadow = true;
        container.add(pedestal);

        // 2. Frosted Glass Bar
        const barMesh = new THREE.Mesh(baseGeo, this.matHealthy);
        barMesh.position.y = 4;
        barMesh.castShadow = true;
        barMesh.receiveShadow = true;
        barMesh.userData = { categoryIndex: index, data: cat };
        container.add(barMesh);

        // 3. Delicate Edges
        const edgeLines = new THREE.LineSegments(edgeGeo, this.edgeMatHealthy);
        barMesh.add(edgeLines);

        // 4. Subtle Base Glow Ring
        const ringGeo = new THREE.RingGeometry(18, 22, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x3b82f6,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 4.2;
        container.add(ring);

        this.barsGroup.add(container);

        this.barObjects.push({
          container: container,
          mesh: barMesh,
          edges: edgeLines,
          ring: ring,
          data: cat,
          currentHeight: 80,
          targetHeight: 80
        });
      });

      this.recalculateHeights();
    }

    recalculateHeights() {
      const weather = this.params.weather;    // -50 to +50
      const discount = this.params.discount;  // 0 to 50
      const leadTime = this.params.leadTime;  // 3 to 28

      this.barObjects.forEach((item) => {
        const cat = item.data;
        // Monte carlo demand elasticity simulation
        const weatherDelta = (weather / 50) * cat.weatherSensitivity * 55;
        const promoDrain = (discount / 50) * cat.promoSensitivity * 75;
        const leadPenalty = ((leadTime - 7) / 14) * cat.leadFactor * 45;

        let height = cat.baseUnits + weatherDelta - promoDrain - leadPenalty;
        height = Math.max(14, Math.min(260, height));

        item.targetHeight = height;
      });
    }

    updateStressVariables(params) {
      if (params) {
        this.params = { ...this.params, ...params };
      }
      this.recalculateHeights();
    }

    initEvents() {
      // Resize handling
      window.addEventListener('resize', () => {
        if (!this.viewport) return;
        this.width = this.viewport.clientWidth;
        this.height = this.viewport.clientHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
      });

      // Mouse drag rotation
      this.isDragging = false;
      this.previousMousePosition = { x: 0, y: 0 };

      this.canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });

      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / this.width) * 2 - 1;
        this.mouse.y = -(((e.clientY - rect.top) / this.height) * 2 - 1);

        if (this.isDragging) {
          const deltaX = e.clientX - this.previousMousePosition.x;
          const deltaY = e.clientY - this.previousMousePosition.y;

          this.barsGroup.rotation.y += deltaX * 0.008;

          this.previousMousePosition = { x: e.clientX, y: e.clientY };
        }

        // Raycasting for interactive hover tooltip
        this.checkRaycast();
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.mouse.set(-999, -999);
        this.hideHoverCard();
      });

      // Reset View Button
      const btnReset = document.getElementById('btn-reset-3d-view');
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          if (window.soundEngine) window.soundEngine.click();
          this.barsGroup.rotation.set(0, 0, 0);
          this.camera.position.copy(this.defaultCameraPos);
          this.camera.lookAt(this.lookAtTarget);
        });
      }

      // Orbit Toggle Button
      const btnOrbit = document.getElementById('btn-toggle-rotate');
      if (btnOrbit) {
        btnOrbit.addEventListener('click', () => {
          if (window.soundEngine) window.soundEngine.click();
          this.isAutoOrbit = !this.isAutoOrbit;
          btnOrbit.textContent = this.isAutoOrbit ? '⏸ Pause' : '▶ Orbit';
          btnOrbit.classList.toggle('active', this.isAutoOrbit);
        });
      }
    }

    checkRaycast() {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const meshes = this.barObjects.map((b) => b.mesh);
      const intersects = this.raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const barItem = this.barObjects.find((b) => b.mesh === hitMesh);

        if (barItem) {
          this.hoveredBar = barItem;
          this.showHoverCard(barItem);
          return;
        }
      }

      this.hoveredBar = null;
      this.hideHoverCard();
    }

    showHoverCard(barItem) {
      if (!this.hoverCard) return;

      const cat = barItem.data;
      const height = Math.round(barItem.currentHeight);

      let status = 'Healthy Buffer';
      let statusClass = 'healthy';
      let safetyMargin = '+24% Above Safety';

      if (height < 40) {
        status = 'Critical Depletion';
        statusClass = 'critical';
        safetyMargin = `-${Math.round((1 - height / 40) * 100)}% Stockout Deficit`;
      } else if (height > 165) {
        status = 'Surplus Overstock';
        statusClass = 'overstock';
        safetyMargin = `+${Math.round((height / 165 - 1) * 100)}% Excess Capital`;
      }

      const elCat = document.getElementById('hover-category-name');
      const elPill = document.getElementById('hover-status-pill');
      const elVel = document.getElementById('hover-velocity');
      const elBuf = document.getElementById('hover-buffer');
      const elSaf = document.getElementById('hover-safety');

      if (elCat) elCat.textContent = cat.name;
      if (elPill) {
        elPill.className = `status-pill ${statusClass}`;
        elPill.textContent = status;
      }
      if (elVel) elVel.textContent = `${cat.baseRunRate} Units / Day`;
      if (elBuf) elBuf.textContent = `${height} Units`;
      if (elSaf) elSaf.textContent = safetyMargin;

      this.hoverCard.style.display = 'block';
    }

    hideHoverCard() {
      if (this.hoverCard) {
        this.hoverCard.style.display = 'none';
      }
    }

    render(time) {
      if (!this.renderer) return;

      // Auto-orbit if toggled
      if (this.isAutoOrbit && !this.isDragging) {
        this.barsGroup.rotation.y += 0.005;
      }

      // Smooth spring interpolation of bar heights & dynamic frosted glass color shift
      this.barObjects.forEach((bar) => {
        bar.currentHeight += (bar.targetHeight - bar.currentHeight) * 0.12;
        bar.mesh.scale.y = bar.currentHeight;

        // Frosted glass material shift
        if (bar.currentHeight < 40) {
          if (bar.mesh.material !== this.matCritical) {
            bar.mesh.material = this.matCritical;
            bar.edges.material = this.edgeMatCritical;
            bar.ring.material.color.setHex(0xef4444);
          }
        } else if (bar.currentHeight > 165) {
          if (bar.mesh.material !== this.matOverstock) {
            bar.mesh.material = this.matOverstock;
            bar.edges.material = this.edgeMatOverstock;
            bar.ring.material.color.setHex(0xf59e0b);
          }
        } else {
          if (bar.mesh.material !== this.matHealthy) {
            bar.mesh.material = this.matHealthy;
            bar.edges.material = this.edgeMatHealthy;
            bar.ring.material.color.setHex(0x2563eb);
          }
        }
      });

      this.renderer.render(this.scene, this.camera);
    }
  }

  // =========================================================================
  // MASTER ORCHESTRATOR
  // =========================================================================

  class Pallets3DSystem {
    constructor() {
      this.headerIcons = new PalletsHeader3DIcons();
      this.heroPackaging = new PalletsHeroPackaging3D();
      this.simulator = new PalletsSimulator3D();

      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    }

    updateSimulation(params) {
      if (this.simulator) {
        this.simulator.updateStressVariables(params);
      }
    }

    animate() {
      requestAnimationFrame(this.animate);
      const time = performance.now() * 0.001;

      if (this.headerIcons) this.headerIcons.render(time);
      if (this.heroPackaging) this.heroPackaging.render(time);
      if (this.simulator) this.simulator.render(time);
    }
  }

  window.Pallets3D = Pallets3DSystem;
  window.Metreecs3D = Pallets3DSystem; // Backward compatibility alias
})();
