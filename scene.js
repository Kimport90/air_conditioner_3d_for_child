// scene.js - 3D Визуализация Сплит-системы Кондиционера на Three.js

class ACScene {
    constructor(container) {
        this.container = container;
        this.width = container.clientWidth || window.innerWidth;
        this.height = container.clientHeight || window.innerHeight;

        // Состояние системы
        this.state = {
            power: true,
            mode: 'cool', // 'cool' | 'heat' | 'fan'
            targetTemp: 22,
            roomTemp: 27,
            fanSpeed: 2, // 1, 2, 3, 4 (turbo)
            xray: true, // Прозрачный хай-тек корпус
            slowMo: false,
            timeScale: 1.0,
            refrigerantFlowSpeed: 1.0,
            activeNodeId: null
        };

        // Физическое состояние для плавной инерции, потоков и шторок
        this.physics = {
            fanRpmCurrent: 25.0,
            fanRpmTarget: 25.0,
            indoorFanRpmCurrent: 22.0,
            indoorFanRpmTarget: 22.0,
            airflowIntensity: 1.0,
            louverAngle: 0.38,
            refrigerantSpeed: 1.0
        };

        // Ссылки на ключевые 3D-объекты для анимации
        this.animatedObjects = {
            indoorFan: null,
            outdoorFan: null,
            outdoorFanRotor: null,
            indoorLouvers: null,
            compressor: null,
            roomAirIn: [],
            roomAirOut: [],
            outdoorAirIn: [],
            outdoorAirOut: [],
            refParticles: null
        };

        this.translucentMaterials = [];
        this.hotspots = [];
        this.cameraTarget = new THREE.Vector3(0, 1.2, 0);
        this.targetCameraPos = null;
        this.defaultCameraPos = new THREE.Vector3(0, 3.2, 7.8);
        this.defaultLookAt = new THREE.Vector3(0, 1.2, 0);

        this.init();
    }

    init() {
        // 1. Сцена, Камера, Рендерер
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e17);
        this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.035);

        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
        this.camera.position.copy(this.defaultCameraPos);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.container.appendChild(this.renderer.domElement);

        // 2. Управление камерой (OrbitControls c автономным fallback)
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        } else if (typeof OrbitControls !== 'undefined') {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        } else {
            // Встроенный автономный контроллер вращения сцены
            this.controls = this.createFallbackControls();
        }

        if (this.controls) {
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2 + 0.05;
            this.controls.minDistance = 1.2;
            this.controls.maxDistance = 22;
            if (this.controls.target) this.controls.target.copy(this.cameraTarget);
        }

        // 3. Освещение сцены
        this.setupLighting();

        // 4. Построение 3D мира
        this.buildEnvironment();
        this.buildIndoorUnit();
        this.buildOutdoorUnit();
        this.buildPiping();
        this.buildCreeper();
        this.setupRefrigerantCircuit();
        this.setupAirflowParticles();
        this.setupHotspots();

        // 5. Обработка кликов и ресайза
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));

        // 6. Запуск главного цикла анимации
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupLighting() {
        // Мягкий рассеянный общий свет
        const ambientLight = new THREE.AmbientLight(0x2d3748, 1.2);
        this.scene.add(ambientLight);

        // Основной верхний направленный свет (имитация студии / солнца)
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
        mainLight.position.set(5, 9, 6);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 25;
        mainLight.shadow.camera.left = -6;
        mainLight.shadow.camera.right = 6;
        mainLight.shadow.camera.top = 6;
        mainLight.shadow.camera.bottom = -6;
        mainLight.shadow.bias = -0.0005;
        this.scene.add(mainLight);

        // Внутренний теплый свет в комнате (слева от стены)
        const roomWarmLight = new THREE.PointLight(0xffeedd, 1.4, 8);
        roomWarmLight.position.set(-2.5, 3.2, 1.5);
        this.scene.add(roomWarmLight);

        // Внешний прохладный уличный свет (справа от стены)
        const outdoorCoolLight = new THREE.PointLight(0x70a5ff, 1.2, 9);
        outdoorCoolLight.position.set(2.8, 3.2, 1.5);
        this.scene.add(outdoorCoolLight);

        // Неоновая кибер-подсветка контуров (синяя и янтарная)
        const accentBlue = new THREE.PointLight(0x00d4ff, 1.5, 5);
        accentBlue.position.set(-2.2, 1.5, 0.2);
        this.scene.add(accentBlue);

        const accentOrange = new THREE.PointLight(0xff6b00, 1.5, 5);
        accentOrange.position.set(2.2, 0.8, 0.2);
        this.scene.add(accentOrange);
    }

    buildEnvironment() {
        // Разделительная стена: Комната (слева, X < 0) и Улица (справа, X > 0)
        // Толщина стены 0.35м по X, проходит в центре X=0
        const wallGroup = new THREE.Group();

        // Сама стена
        const wallGeo = new THREE.BoxGeometry(0.35, 4.5, 5.0);
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x1f293d,
            roughness: 0.8,
            metalness: 0.1
        });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(0, 2.0, 0);
        wall.receiveShadow = true;
        wall.castShadow = true;
        wallGroup.add(wall);

        // Декоративный срез стены (чтобы видеть толщину как на инфографике)
        const trimGeo = new THREE.BoxGeometry(0.37, 4.52, 0.1);
        const trimMat = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x1d4ed8,
            emissiveIntensity: 0.2
        });
        const trim = new THREE.Mesh(trimGeo, trimMat);
        trim.position.set(0, 2.0, 2.5);
        wallGroup.add(trim);

        // Гильза/отверстие в стене для прохода медных трубок
        const sleeveGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 24);
        sleeveGeo.rotateZ(Math.PI / 2);
        const sleeveMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            roughness: 0.5,
            metalness: 0.7
        });
        const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
        sleeve.position.set(0, 1.9, 0);
        wallGroup.add(sleeve);

        // Пол комнаты (слева, уютный деревянный ламинат / технологичная сетка)
        const roomFloorGeo = new THREE.PlaneGeometry(4.5, 5.0);
        const roomFloorMat = new THREE.MeshStandardMaterial({
            color: 0x182030,
            roughness: 0.4,
            metalness: 0.2
        });
        const roomFloor = new THREE.Mesh(roomFloorGeo, roomFloorMat);
        roomFloor.rotation.x = -Math.PI / 2;
        roomFloor.position.set(-2.4, -0.25, 0);
        roomFloor.receiveShadow = true;
        wallGroup.add(roomFloor);

        // Пол улицы (справа, плитка балкона / фасад)
        const outdoorFloorGeo = new THREE.PlaneGeometry(4.5, 5.0);
        const outdoorFloorMat = new THREE.MeshStandardMaterial({
            color: 0x0e1422,
            roughness: 0.9,
            metalness: 0.1
        });
        const outdoorFloor = new THREE.Mesh(outdoorFloorGeo, outdoorFloorMat);
        outdoorFloor.rotation.x = -Math.PI / 2;
        outdoorFloor.position.set(2.4, -0.25, 0);
        outdoorFloor.receiveShadow = true;
        wallGroup.add(outdoorFloor);

        // Плинтусы и 3D-надписи "КОМНАТА" и "УЛИЦА"
        const roomLabel = this.createFloatingTextBadge("🏠 КОМНАТА (+24°C)", -2.3, 3.9, 0, 0x38bdf8);
        const outdoorLabel = this.createFloatingTextBadge("☀️ УЛИЦА (+32°C)", 2.3, 3.9, 0, 0xf97316);
        this.roomLabelMesh = roomLabel;
        this.outdoorLabelMesh = outdoorLabel;
        wallGroup.add(roomLabel);
        wallGroup.add(outdoorLabel);

        this.scene.add(wallGroup);
    }

    createFloatingTextBadge(text, x, y, z, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.roundRect(10, 10, 492, 108, 24);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
        ctx.stroke();

        ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(x, y, z);
        sprite.scale.set(1.4, 0.35, 1);
        return sprite;
    }

    buildIndoorUnit() {
        // Внутренний блок кондиционера (на стене в комнате)
        // Координаты: X = -1.6, Y = 2.4, Z = 0
        const indoorGroup = new THREE.Group();
        indoorGroup.position.set(-1.6, 2.4, 0);

        const width = 1.6;
        const height = 0.65;
        const depth = 0.45;

        // Полупрозрачный хай-тек корпус
        const caseGeo = new THREE.BoxGeometry(width, height, depth);
        const caseMat = new THREE.MeshPhysicalMaterial({
            color: 0xe2e8f0,
            transparent: true,
            opacity: 0.35,
            roughness: 0.15,
            metalness: 0.1,
            transmission: 0.75, // Стекловидная передача света
            ior: 1.4,
            clearcoat: 0.8,
            side: THREE.DoubleSide
        });
        this.indoorCaseMesh = new THREE.Mesh(caseGeo, caseMat);
        this.indoorCaseMesh.castShadow = true;
        indoorGroup.add(this.indoorCaseMesh);
        this.translucentMaterials.push(caseMat);

        // Внутренняя рама и монтажная плата
        const backPlateGeo = new THREE.BoxGeometry(width * 0.98, height * 0.96, 0.03);
        const backPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.5 });
        const backPlate = new THREE.Mesh(backPlateGeo, backPlateMat);
        backPlate.position.set(0, 0, -depth / 2 + 0.02);
        indoorGroup.add(backPlate);

        // Испаритель (радиатор охлаждения) - изогнутая многорядная медная змейка с ламелями
        const evapGroup = new THREE.Group();
        evapGroup.position.set(0, 0.08, -0.02);

        const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x00f2fe,
            metalness: 0.85,
            roughness: 0.2,
            emissive: 0x0284c7,
            emissiveIntensity: 0.4
        });
        this.evaporatorTubeMat = tubeMat;

        // Создаем змейку трубок испарителя
        const rows = 4;
        const passes = 6;
        for (let r = 0; r < rows; r++) {
            for (let p = 0; p < passes; p++) {
                const tubeGeo = new THREE.CylinderGeometry(0.016, 0.016, width * 0.82, 16);
                tubeGeo.rotateZ(Math.PI / 2);
                const tube = new THREE.Mesh(tubeGeo, tubeMat);
                // Форма крыши/домика испарителя (наклонный радиатор)
                const angle = 0.25;
                tube.position.set(
                    0,
                    (p - passes / 2) * 0.05 + 0.05,
                    (r - rows / 2) * 0.05 - (p * 0.025)
                );
                evapGroup.add(tube);
            }
        }

        // Алюминиевые ребра теплообменника (тонкие полупрозрачные пластинки)
        const finGeo = new THREE.BoxGeometry(width * 0.82, 0.32, 0.22);
        const finMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.3,
            metalness: 0.9,
            roughness: 0.1
        });
        const finBlock = new THREE.Mesh(finGeo, finMat);
        finBlock.rotation.x = -0.3;
        finBlock.position.set(0, 0.05, -0.05);
        evapGroup.add(finBlock);
        indoorGroup.add(evapGroup);
        this.evaporatorGroup = evapGroup;

        // Турбинный барабанный вентилятор («Беличье колесо» / Cross-flow Fan)
        // В реальном кондиционере это аккуратный длинный горизонтальный цилиндр
        const fanGroup = new THREE.Group();
        fanGroup.position.set(0, -0.14, 0.03);

        const fanLength = width * 0.74; // Длина цилиндра вдоль оси X
        const fanRadius = 0.070;        // Радиус барабана (аккуратно помещается внутри блока)
        const bladeCount = 24;          // 24 тонкие загнутые лопатки

        // Центральная металлическая ось вращения
        const shaftGeo = new THREE.CylinderGeometry(0.007, 0.007, fanLength + 0.06, 16);
        shaftGeo.rotateZ(Math.PI / 2);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });
        fanGroup.add(new THREE.Mesh(shaftGeo, shaftMat));

        // Разделительные кольца / диски жесткости вдоль барабана (6 секций)
        const discMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            metalness: 0.7,
            roughness: 0.3
        });
        const discCount = 6;
        for (let d = 0; d < discCount; d++) {
            const discGeo = new THREE.CylinderGeometry(fanRadius, fanRadius, 0.004, 24);
            discGeo.rotateZ(Math.PI / 2);
            const disc = new THREE.Mesh(discGeo, discMat);
            const xPos = (d / (discCount - 1) - 0.5) * (fanLength - 0.02);
            disc.position.set(xPos, 0, 0);
            fanGroup.add(disc);
        }

        // Лопатки барабана (ориентированы строго вдоль горизонтальной оси X)
        const bladeMat = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            metalness: 0.5,
            roughness: 0.3,
            transparent: true,
            opacity: 0.85
        });

        // Длина лопатки идет вдоль оси X (без rotateZ!), а сечение наклонено по касательной
        const bladeGeo = new THREE.BoxGeometry(fanLength * 0.98, 0.016, 0.002);

        for (let i = 0; i < bladeCount; i++) {
            const angle = (i / bladeCount) * Math.PI * 2;
            const blade = new THREE.Mesh(bladeGeo, bladeMat);

            // Размещаем лопатку по окружности цилиндра в плоскости Y-Z
            blade.position.set(
                0,
                Math.cos(angle) * fanRadius,
                Math.sin(angle) * fanRadius
            );

            // Наклон лопатки вперед по направлению вращения (аэродинамический профиль)
            blade.rotation.x = angle + 0.45;
            fanGroup.add(blade);
        }

        indoorGroup.add(fanGroup);
        this.animatedObjects.indoorFan = fanGroup;

        // Электропривод вентилятора сбоку (мотор в правом торце)
        const motorGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 20);
        motorGeo.rotateZ(Math.PI / 2);
        const fanMotor = new THREE.Mesh(motorGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 }));
        fanMotor.position.set(fanLength / 2 + 0.05, -0.14, 0.03);
        indoorGroup.add(fanMotor);

        // Подшипниковый узел в левом торце
        const bearingGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16);
        bearingGeo.rotateZ(Math.PI / 2);
        const bearing = new THREE.Mesh(bearingGeo, new THREE.MeshStandardMaterial({ color: 0x475569 }));
        bearing.position.set(-fanLength / 2 - 0.025, -0.14, 0.03);
        indoorGroup.add(bearing);

        // Направляющие жалюзи снизу (выход воздуха)
        const louverGeo = new THREE.BoxGeometry(width * 0.82, 0.012, 0.12);
        const louverMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.4
        });
        const louver = new THREE.Mesh(louverGeo, louverMat);
        louver.position.set(0, -height / 2 + 0.04, 0.14);
        louver.rotation.x = 0.4;
        indoorGroup.add(louver);
        this.animatedObjects.indoorLouvers = louver;

        // Цифровой неоновый дисплей на передней панели
        this.displayMesh = this.createDigitalDisplay("22°C");
        this.displayMesh.position.set(width * 0.32, 0, depth / 2 + 0.002);
        indoorGroup.add(this.displayMesh);

        // Верхняя решетка забора воздуха
        const grillGeo = new THREE.BoxGeometry(width * 0.84, 0.02, depth * 0.7);
        const grillMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            wireframe: true
        });
        const grill = new THREE.Mesh(grillGeo, grillMat);
        grill.position.set(0, height / 2 - 0.01, -0.02);
        indoorGroup.add(grill);

        this.indoorGroup = indoorGroup;
        this.scene.add(indoorGroup);
    }

    createDigitalDisplay(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        this.displayCanvas = canvas;
        this.displayCtx = ctx;

        this.updateDisplayText(text, '#00e5ff');

        const texture = new THREE.CanvasTexture(canvas);
        this.displayTexture = texture;
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const geo = new THREE.PlaneGeometry(0.28, 0.14);
        return new THREE.Mesh(geo, mat);
    }

    updateDisplayText(text, colorHex) {
        if (!this.displayCtx) return;
        const ctx = this.displayCtx;
        ctx.clearRect(0, 0, 256, 128);

        // Фоновая рамка дисплея
        ctx.fillStyle = 'rgba(10, 15, 28, 0.9)';
        ctx.roundRect(10, 10, 236, 108, 16);
        ctx.fill();

        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = 'bold 54px "Courier New", monospace, sans-serif';
        ctx.fillStyle = colorHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = 12;
        ctx.fillText(text, 128, 64);

        if (this.displayTexture) {
            this.displayTexture.needsUpdate = true;
        }
    }

    buildOutdoorUnit() {
        // Внешний блок (на улице справа, на кронштейнах у стены)
        // Координаты: X = 1.8, Y = 1.1, Z = 0
        const outdoorGroup = new THREE.Group();
        outdoorGroup.position.set(1.8, 1.1, 0);

        const width = 1.5;
        const height = 1.05;
        const depth = 0.65;

        // Полупрозрачный защитный кожух
        const caseGeo = new THREE.BoxGeometry(width, height, depth);
        const caseMat = new THREE.MeshPhysicalMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.35,
            roughness: 0.25,
            metalness: 0.4,
            transmission: 0.7,
            clearcoat: 0.5,
            side: THREE.DoubleSide
        });
        this.outdoorCaseMesh = new THREE.Mesh(caseGeo, caseMat);
        this.outdoorCaseMesh.castShadow = true;
        outdoorGroup.add(this.outdoorCaseMesh);
        this.translucentMaterials.push(caseMat);

        // Монтажные металлические кронштейны к стене и полу
        const bracketGeo = new THREE.BoxGeometry(1.6, 0.05, 0.05);
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 });
        const b1 = new THREE.Mesh(bracketGeo, bracketMat);
        b1.position.set(-0.1, -height / 2 - 0.03, depth / 2 - 0.08);
        const b2 = new THREE.Mesh(bracketGeo, bracketMat);
        b2.position.set(-0.1, -height / 2 - 0.03, -depth / 2 + 0.08);
        outdoorGroup.add(b1);
        outdoorGroup.add(b2);

        // 1. КОМПРЕССОР ("Сердце системы")
        // Размещается справа в отсеке внешнего блока
        const compGroup = new THREE.Group();
        compGroup.position.set(width * 0.28, -0.08, -0.05);

        // Основной цилиндрический корпус компрессора
        const compBodyGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.55, 32);
        const compMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.85,
            roughness: 0.25
        });
        const compBody = new THREE.Mesh(compBodyGeo, compMat);
        compGroup.add(compBody);

        // Верхняя и нижняя полусферы
        const compCapGeo = new THREE.SphereGeometry(0.16, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const topCap = new THREE.Mesh(compCapGeo, compMat);
        topCap.position.set(0, 0.275, 0);
        compGroup.add(topCap);

        // Аккумулятор-докипатель (меньший цилиндр сбоку компрессора)
        const accGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.38, 24);
        const accMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
        const acc = new THREE.Mesh(accGeo, accMat);
        acc.position.set(-0.21, 0.02, 0);
        compGroup.add(acc);

        // Соединительная трубка аккумулятора
        const accPipeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 16);
        accPipeGeo.rotateZ(Math.PI / 2);
        const accPipe = new THREE.Mesh(accPipeGeo, new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.9 }));
        accPipe.position.set(-0.1, -0.08, 0);
        compGroup.add(accPipe);

        // Виброопоры компрессора (резиновые ножки)
        for (let a = 0; a < 3; a++) {
            const rad = (a / 3) * Math.PI * 2;
            const footGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16);
            const foot = new THREE.Mesh(footGeo, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.9 }));
            foot.position.set(Math.cos(rad) * 0.15, -0.29, Math.sin(rad) * 0.15);
            compGroup.add(foot);
        }

        outdoorGroup.add(compGroup);
        this.animatedObjects.compressor = compGroup;
        this.compressorGroup = compGroup;

        // 2. КОНДЕНСАТОР (Внешний радиатор сброса тепла)
        // Изогнут Г-образно по задней и боковой стенке
        const condGroup = new THREE.Group();
        condGroup.position.set(-width * 0.1, 0, -depth / 2 + 0.06);

        const condTubeMat = new THREE.MeshStandardMaterial({
            color: 0xff4500,
            metalness: 0.85,
            roughness: 0.2,
            emissive: 0xd97706,
            emissiveIntensity: 0.4
        });
        this.condenserTubeMat = condTubeMat;

        // Змеевик конденсатора
        const cRows = 6;
        const cPasses = 8;
        for (let p = 0; p < cPasses; p++) {
            const tGeo = new THREE.CylinderGeometry(0.014, 0.014, width * 0.65, 16);
            tGeo.rotateZ(Math.PI / 2);
            const tube = new THREE.Mesh(tGeo, condTubeMat);
            tube.position.set(0, (p - cPasses / 2) * 0.09 + 0.05, 0);
            condGroup.add(tube);
        }

        // Ребра конденсатора (радиаторная решетка)
        const condFinsGeo = new THREE.BoxGeometry(width * 0.68, height * 0.8, 0.08);
        const condFinsMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            metalness: 0.9,
            roughness: 0.2,
            transparent: true,
            opacity: 0.35
        });
        const condFins = new THREE.Mesh(condFinsGeo, condFinsMat);
        condGroup.add(condFins);
        outdoorGroup.add(condGroup);
        this.condenserGroup = condGroup;

        // 3. ОСЕВОЙ ВЕНТИЛЯТОР НАРУЖНОГО БЛОКА ВЫСОКОГО РЕАЛИЗМА
        // Аэродинамический диффузор, защитная решетка и серповидный 3-лопастной пропеллер
        this.buildRealisticOutdoorFan(outdoorGroup, width, height, depth);

        // 4. ДРОССЕЛЬ / ТРВ (Расширительный клапан / Капиллярная трубка)
        // Точка резкого перепада давления между высоким и низким
        const valveGroup = new THREE.Group();
        valveGroup.position.set(width * 0.38, -0.32, depth * 0.15);

        // Латунный корпус клапана ТРВ
        const vBodyGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16);
        const vBodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });
        valveGroup.add(new THREE.Mesh(vBodyGeo, vBodyMat));

        // Спиральная капиллярная медная трубка
        const capCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.06, 0),
            new THREE.Vector3(0.04, 0.04, 0.04),
            new THREE.Vector3(-0.04, 0.02, 0.04),
            new THREE.Vector3(0.04, 0.0, -0.04),
            new THREE.Vector3(-0.04, -0.02, -0.04),
            new THREE.Vector3(0, -0.06, 0)
        ]);
        const capGeo = new THREE.TubeGeometry(capCurve, 32, 0.008, 8, false);
        const capMesh = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9 }));
        valveGroup.add(capMesh);

        outdoorGroup.add(valveGroup);
        this.expansionValveGroup = valveGroup;

        // 5. 4-ХОДОВОЙ РЕВЕРСИВНЫЙ КЛАПАН (Переключатель Охлаждение/Обогрев)
        const revGroup = new THREE.Group();
        revGroup.position.set(width * 0.2, 0.26, -0.05);

        const revBodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 16);
        revBodyGeo.rotateZ(Math.PI / 2);
        const revBodyMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.3 });
        revGroup.add(new THREE.Mesh(revBodyGeo, revBodyMat));

        // Электромагнитный соленоид управления
        const solGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
        const solMesh = new THREE.Mesh(solGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
        solMesh.position.set(0.11, 0, 0);
        revGroup.add(solMesh);

        outdoorGroup.add(revGroup);
        this.reversingValveGroup = revGroup;

        this.outdoorGroup = outdoorGroup;
        this.scene.add(outdoorGroup);
    }

    buildRealisticOutdoorFan(outdoorGroup, width, height, depth) {
        const fanCenter = new THREE.Vector3(-width * 0.12, 0, depth / 2 - 0.14);

        // 1. СТАТИЧЕСКИЙ КОРПУС, МОТОР, ДИФФУЗОР И РЕШЕТКА
        const staticGroup = new THREE.Group();
        staticGroup.position.copy(fanCenter);

        // Аэродинамический раструб-диффузор (cylindrical bellmouth shroud)
        const shroudRadius = 0.385;
        const shroudGeo = new THREE.CylinderGeometry(shroudRadius, shroudRadius + 0.015, 0.16, 48, 1, true);
        shroudGeo.rotateX(Math.PI / 2);
        const shroudMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.45,
            roughness: 0.5,
            side: THREE.DoubleSide
        });
        const shroudMesh = new THREE.Mesh(shroudGeo, shroudMat);
        staticGroup.add(shroudMesh);

        // Передний закругленный аэродинамический обод раструба
        const lipGeo = new THREE.TorusGeometry(shroudRadius + 0.008, 0.014, 16, 48);
        const lipMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.6,
            roughness: 0.35
        });
        const lipMesh = new THREE.Mesh(lipGeo, lipMat);
        lipMesh.position.set(0, 0, 0.08);
        staticGroup.add(lipMesh);

        // Электродвигатель вентилятора (позади лопастей)
        const motorGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.14, 24);
        motorGeo.rotateX(Math.PI / 2);
        const motorMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            metalness: 0.85,
            roughness: 0.25
        });
        const motorMesh = new THREE.Mesh(motorGeo, motorMat);
        motorMesh.position.set(0, 0, -0.05);
        staticGroup.add(motorMesh);

        // Ребра охлаждения на корпусе электродвигателя
        for (let i = 0; i < 4; i++) {
            const finRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.078, 0.004, 8, 24),
                motorMat
            );
            finRing.position.set(0, 0, -0.09 + i * 0.026);
            staticGroup.add(finRing);
        }

        // 3 радиальные несущие стойки крепления мотора к диффузору
        for (let s = 0; s < 3; s++) {
            const angle = (s / 3) * Math.PI * 2 + Math.PI / 6;
            const strutGeo = new THREE.BoxGeometry(0.016, shroudRadius - 0.075, 0.02);
            const strut = new THREE.Mesh(strutGeo, shroudMat);
            const midR = (shroudRadius + 0.075) / 2;
            strut.position.set(Math.cos(angle) * midR, Math.sin(angle) * midR, -0.05);
            strut.rotation.z = angle - Math.PI / 2;
            strut.rotation.y = 0.25;
            staticGroup.add(strut);
        }

        // Фронтальная защитная решетка (концентрические стальные кольца + спицы)
        const grillGroup = new THREE.Group();
        grillGroup.position.set(0, 0, 0.085);
        const wireMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            metalness: 0.85,
            roughness: 0.2
        });

        // 5 концентрических защитных колец
        const ringRadii = [0.10, 0.17, 0.24, 0.31, 0.38];
        ringRadii.forEach(r => {
            const rGeo = new THREE.TorusGeometry(r, 0.004, 8, 48);
            const rMesh = new THREE.Mesh(rGeo, wireMat);
            grillGroup.add(rMesh);
        });

        // 4 радиальные силовые спицы
        for (let sp = 0; sp < 4; sp++) {
            const spokeAngle = (sp / 4) * Math.PI * 2;
            const spokeGeo = new THREE.CylinderGeometry(0.0045, 0.0045, shroudRadius * 2, 8);
            const spoke = new THREE.Mesh(spokeGeo, wireMat);
            spoke.rotation.z = spokeAngle;
            grillGroup.add(spoke);
        }

        // Центральная плашка / логотип в центре решетки
        const badgeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.012, 24);
        badgeGeo.rotateX(Math.PI / 2);
        const badgeMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.6,
            roughness: 0.3
        });
        const badge = new THREE.Mesh(badgeGeo, badgeMat);
        grillGroup.add(badge);

        staticGroup.add(grillGroup);
        outdoorGroup.add(staticGroup);

        // 2. ВРАЩАЮЩИЙСЯ РОТОР (КОК + 3 СЕРПОВИДНЫЕ АЭРОДИНАМИЧЕСКИЕ ЛОПАСТИ)
        const rotorGroup = new THREE.Group();
        rotorGroup.position.copy(fanCenter);
        rotorGroup.position.z += 0.018; // Лопасти внутри раструба

        // Обтекаемый носовой кок ступицы (bullet nose spinner cone)
        const spinnerGeo = new THREE.CylinderGeometry(0.02, 0.085, 0.10, 32);
        spinnerGeo.rotateX(Math.PI / 2);
        const spinnerMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.7,
            roughness: 0.25
        });
        const spinner = new THREE.Mesh(spinnerGeo, spinnerMat);
        spinner.position.set(0, 0, 0.03);
        rotorGroup.add(spinner);

        const noseCap = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 16, 16),
            spinnerMat
        );
        noseCap.position.set(0, 0, 0.08);
        rotorGroup.add(noseCap);

        // 3 Серповидные реалистичные лопасти
        const bladeMat = new THREE.MeshStandardMaterial({
            color: 0x3b4759,
            metalness: 0.55,
            roughness: 0.28,
            side: THREE.DoubleSide
        });

        for (let b = 0; b < 3; b++) {
            const bladeAngle = (b / 3) * Math.PI * 2;
            const bladeMesh = this.createSickleBladeMesh(bladeMat);
            bladeMesh.rotation.z = bladeAngle;
            rotorGroup.add(bladeMesh);
        }

        outdoorGroup.add(rotorGroup);
        this.animatedObjects.outdoorFanRotor = rotorGroup;
        this.animatedObjects.outdoorFan = rotorGroup;
    }

    createSickleBladeMesh(material) {
        // Создаем реалистичную серповидную лопасть с профилем и закруткой (washout twist)
        const rRoot = 0.08;
        const rTip = 0.36;
        const radialSteps = 9;
        const chordSteps = 7;

        const vertices = [];
        const indices = [];
        const uvs = [];

        for (let i = 0; i <= radialSteps; i++) {
            const u = i / radialSteps;
            const r = rRoot + u * (rTip - rRoot);

            // Аэродинамическая закрутка угла атаки: от 34° у корня до 16° на конце
            const pitch = 0.60 - u * 0.32;

            // Серповидный изгиб лопасти назад (backward sickle sweep)
            const sweep = Math.pow(u, 1.4) * 0.45;

            // Хорда лопасти: утолщается в средней части
            const chord = 0.095 + Math.sin(u * Math.PI) * 0.075;

            for (let j = 0; j <= chordSteps; j++) {
                const v = j / chordSteps;

                // Профиль толщины и прогиба
                const camber = Math.sin(v * Math.PI) * (0.016 - u * 0.007);

                const cDist = (v - 0.32) * chord;
                const localX = cDist * Math.cos(pitch);
                const localZ = cDist * Math.sin(pitch) + camber;

                const polarAngle = sweep + localX / r;
                const finalX = r * Math.cos(polarAngle);
                const finalY = r * Math.sin(polarAngle);
                const finalZ = localZ;

                vertices.push(finalX, finalY, finalZ);
                uvs.push(u, v);
            }
        }

        const stride = chordSteps + 1;
        for (let i = 0; i < radialSteps; i++) {
            for (let j = 0; j < chordSteps; j++) {
                const a = i * stride + j;
                const b = (i + 1) * stride + j;
                const c = (i + 1) * stride + (j + 1);
                const d = i * stride + (j + 1);

                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        return new THREE.Mesh(geo, material);
    }

    buildPiping() {
        // Медные трубки межблочной трассы, проходящие через гильзу в стене (X = 0, Y = 1.9, Z = 0)
        const pipeGroup = new THREE.Group();

        // 1. Толстая газовая трубка (обратка низкого давления)
        // Идет от внутреннего блока (-1.6, 2.3, 0) через стену (0, 1.9, 0.03) к внешнему блоку (1.8, 1.3, 0)
        const gasCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.0, 2.25, 0.0),
            new THREE.Vector3(-0.3, 2.05, 0.02),
            new THREE.Vector3(0.0, 1.92, 0.03),
            new THREE.Vector3(0.4, 1.75, 0.02),
            new THREE.Vector3(1.2, 1.35, -0.05),
            new THREE.Vector3(1.7, 1.25, -0.05)
        ]);
        const gasGeo = new THREE.TubeGeometry(gasCurve, 48, 0.022, 12, false);
        const gasMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            metalness: 0.85,
            roughness: 0.3
        });
        this.gasPipeMesh = new THREE.Mesh(gasGeo, gasMat);
        pipeGroup.add(this.gasPipeMesh);

        // 2. Тонкая жидкостная трубка (высокое давление)
        const liquidCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.0, 2.2, -0.03),
            new THREE.Vector3(-0.3, 2.0, -0.02),
            new THREE.Vector3(0.0, 1.88, -0.02),
            new THREE.Vector3(0.4, 1.7, -0.02),
            new THREE.Vector3(1.2, 1.1, 0.08),
            new THREE.Vector3(1.7, 0.85, 0.15)
        ]);
        const liquidGeo = new THREE.TubeGeometry(liquidCurve, 48, 0.013, 12, false);
        const liquidMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            metalness: 0.9,
            roughness: 0.2
        });
        this.liquidPipeMesh = new THREE.Mesh(liquidGeo, liquidMat);
        pipeGroup.add(this.liquidPipeMesh);

        this.scene.add(pipeGroup);
    }

    // ----------------------------------------------------
    // ПАСХАЛКА: 3D КРИПЕР ИЗ MINECRAFT
    // ----------------------------------------------------
    generateCreeperTextures() {
        const greenPalette = [
            '#427429', '#568c34', '#335d1f', '#68a63e', 
            '#284a17', '#75b945', '#4b832e', '#5ea037'
        ];
        const darkPalette = ['#121212', '#1b1b1b', '#242424', '#0d0d0d'];

        // 1. Текстура лица Крипера (8x8 ячеек по 16px = 128x128px)
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 128;
        faceCanvas.height = 128;
        const faceCtx = faceCanvas.getContext('2d');
        faceCtx.imageSmoothingEnabled = false;

        const facePattern = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 1, 1, 0],
            [0, 1, 1, 0, 0, 1, 1, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ];

        const cellSize = 16;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (facePattern[r][c] === 1) {
                    faceCtx.fillStyle = darkPalette[Math.floor(Math.random() * darkPalette.length)];
                } else {
                    faceCtx.fillStyle = greenPalette[Math.floor(Math.random() * greenPalette.length)];
                }
                faceCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }

        const faceTexture = new THREE.CanvasTexture(faceCanvas);
        faceTexture.magFilter = THREE.NearestFilter;
        faceTexture.minFilter = THREE.NearestFilter;

        // 2. Текстура тела и ног (пиксельный зеленый камуфляж)
        const bodyCanvas = document.createElement('canvas');
        bodyCanvas.width = 128;
        bodyCanvas.height = 128;
        const bodyCtx = bodyCanvas.getContext('2d');
        bodyCtx.imageSmoothingEnabled = false;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                bodyCtx.fillStyle = greenPalette[Math.floor(Math.random() * greenPalette.length)];
                bodyCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }

        const bodyTexture = new THREE.CanvasTexture(bodyCanvas);
        bodyTexture.magFilter = THREE.NearestFilter;
        bodyTexture.minFilter = THREE.NearestFilter;

        return { faceTexture, bodyTexture };
    }

    buildCreeper() {
        const { faceTexture, bodyTexture } = this.generateCreeperTextures();

        this.creeperGroup = new THREE.Group();
        // Размещаем на полу комнаты прямо под нисходящим потоком кондиционера
        this.creeperBasePos = new THREE.Vector3(-2.1, -0.25, 0.95);
        this.creeperGroup.position.copy(this.creeperBasePos);

        const greenMat = new THREE.MeshStandardMaterial({
            map: bodyTexture,
            roughness: 0.85,
            metalness: 0.05
        });

        // 1. Голова (куб 0.24 x 0.24 x 0.24)
        const faceMat = new THREE.MeshStandardMaterial({
            map: faceTexture,
            roughness: 0.85,
            metalness: 0.05
        });
        const headMaterials = [greenMat, greenMat, greenMat, greenMat, faceMat, greenMat];
        const headGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
        this.creeperHead = new THREE.Mesh(headGeo, headMaterials);
        this.creeperHead.castShadow = true;
        this.creeperHead.position.set(0, 0.60, 0);

        // 2. Тело (0.24 x 0.32 x 0.14)
        const bodyGeo = new THREE.BoxGeometry(0.24, 0.32, 0.14);
        this.creeperBody = new THREE.Mesh(bodyGeo, greenMat);
        this.creeperBody.castShadow = true;
        this.creeperBody.position.set(0, 0.32, 0);

        // 3. Лапы (4 штуки: 0.10 x 0.16 x 0.10)
        const legGeo = new THREE.BoxGeometry(0.10, 0.16, 0.10);
        const legOffsets = [
            [-0.065, 0.08, 0.065],  // передняя левая
            [0.065, 0.08, 0.065],   // передняя правая
            [-0.065, 0.08, -0.065], // задняя левая
            [0.065, 0.08, -0.065]   // задняя правая
        ];
        this.creeperLegs = [];
        legOffsets.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, greenMat);
            leg.castShadow = true;
            leg.position.set(pos[0], pos[1], pos[2]);
            this.creeperGroup.add(leg);
            this.creeperLegs.push(leg);
        });

        // Мягкая тень под ногами на полу
        const shadowGeo = new THREE.PlaneGeometry(0.36, 0.36);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x070b12,
            transparent: true,
            opacity: 0.55
        });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, 0.002, 0);
        this.creeperGroup.add(shadow);

        this.creeperGroup.add(this.creeperBody);
        this.creeperGroup.add(this.creeperHead);

        // Поворот лицом к центру комнаты
        this.creeperGroup.rotation.y = 0.42;

        // Кликабельные объекты для Raycaster
        this.creeperClickables = [this.creeperHead, this.creeperBody, ...this.creeperLegs];
        this.creeperClickables.forEach(mesh => {
            mesh.userData.isCreeper = true;
        });

        // 4. Облачко реплик
        this.buildCreeperSpeechBubble();

        this.scene.add(this.creeperGroup);

        this.creeperState = {
            isJumping: false,
            jumpProgress: 0,
            bubbleTimer: 0
        };
    }

    buildCreeperSpeechBubble() {
        this.speechBubbleCanvas = document.createElement('canvas');
        this.speechBubbleCanvas.width = 512;
        this.speechBubbleCanvas.height = 256;
        this.speechBubbleCtx = this.speechBubbleCanvas.getContext('2d');

        this.speechBubbleTexture = new THREE.CanvasTexture(this.speechBubbleCanvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: this.speechBubbleTexture,
            transparent: true,
            opacity: 0
        });

        this.speechBubbleSprite = new THREE.Sprite(spriteMat);
        this.speechBubbleSprite.position.set(0, 0.95, 0);
        this.speechBubbleSprite.scale.set(1.4, 0.7, 1);
        this.creeperGroup.add(this.speechBubbleSprite);
    }

    renderSpeechBubble(text) {
        const ctx = this.speechBubbleCtx;
        const w = 512;
        const h = 256;
        ctx.clearRect(0, 0, w, h);

        // Фон комиксного облачка
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 6;

        // Закругленное тело облачка
        ctx.beginPath();
        ctx.roundRect(16, 16, 480, 165, 22);
        ctx.fill();
        ctx.stroke();

        // Хвостик вниз к голове Крипера
        ctx.beginPath();
        ctx.moveTo(232, 180);
        ctx.lineTo(256, 235);
        ctx.lineTo(280, 180);
        ctx.closePath();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fill();
        ctx.stroke();

        // Заголовок-бейдж
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🟩 КРИПЕР ИЗ MINECRAFT', 256, 46);

        // Текст реплики
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const words = text.split(' ');
        const lines = [];
        let curLine = '';
        words.forEach(word => {
            const testLine = curLine ? `${curLine} ${word}` : word;
            if (ctx.measureText(testLine).width > 440) {
                lines.push(curLine);
                curLine = word;
            } else {
                curLine = testLine;
            }
        });
        if (curLine) lines.push(curLine);

        const lineHeight = 32;
        const startY = 110 - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, idx) => {
            ctx.fillText(line, 256, startY + idx * lineHeight);
        });

        this.speechBubbleTexture.needsUpdate = true;
    }

    onCreeperClicked() {
        if (window.soundEngine) {
            window.soundEngine.playCreeperSound();
        }

        // Запуск анимации прыжка и таймера реплики
        this.creeperState.isJumping = true;
        this.creeperState.jumpProgress = 0;
        this.creeperState.bubbleTimer = 3.6;

        let phrasePool = [];
        if (!this.state.power) {
            phrasePool = [
                "Шшш... Кондиционер спит, и я отдыхаю! Включи ⏻!",
                "Без кондиционера душно... Запусти прохладу на пульте!",
                "Ш-ш-ш... Тихо в комнате, никто не взрывается!"
            ];
        } else if (this.state.mode === 'cool') {
            phrasePool = [
                `Бррр! Сделай потеплее, а то я замерзну! (+${this.state.targetTemp}°C)`,
                "Ш-ш-ш... Поток холода дует прямо на меня!",
                "Ого, мороз! У меня порох превратился в сосульки!",
                `Шшш... Я не крипер, я снеговик! (+${this.state.targetTemp}°C)`
            ];
        } else if (this.state.mode === 'heat') {
            phrasePool = [
                "Ооо, тепло пошло! Вот бы такой обогрев в шахту...",
                "Шшш... Приятный теплый ветерок, даже взрываться неохота!",
                `Как хорошо погреться под комнатным блоком! (+${this.state.targetTemp}°C)`
            ];
        } else {
            phrasePool = [
                "Ш-ш-ш... Ветерок отличный, лопасти крутятся!",
                "Привет! Не бойся, я не бум-бум, я просто охлаждаюсь!",
                "Кондиционеры — это наука! Круто тут всё устроено!"
            ];
        }

        const phrase = phrasePool[Math.floor(Math.random() * phrasePool.length)];
        this.renderSpeechBubble(phrase);
    }

    onPointerMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const clickables = this.hotspotMeshes.map(h => h.sphere);
        if (this.creeperClickables) {
            clickables.push(...this.creeperClickables);
        }
        const intersects = this.raycaster.intersectObjects(clickables);
        this.renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
    }

    setupRefrigerantCircuit() {
        // Замкнутый контур циркуляции хладагента (CatmullRomCurve3)
        // Полный цикл:
        // 1. Компрессор сжимает газ (X: ~2.2, Y: ~1.2, Z: ~ -0.05)
        // 2. Выход горячего газа в Конденсатор наружного блока
        // 3. Конденсатор: газ охлаждается и переходит в жидкость
        // 4. ТРВ (дроссель): резкое падение давления
        // 5. Тонкая трубка через стену к Внутреннему блоку
        // 6. Испаритель: жидкость кипит, отбирает тепло комнатного воздуха, превращается в холодный газ
        // 7. Толстая трубка через стену обратно в Компрессор
        const waypoints = [
            // Внутри компрессора (сжатие)
            new THREE.Vector3(2.22, 1.25, -0.05),
            new THREE.Vector3(2.22, 1.45, -0.05), // Выход горячего газа под высоким давлением

            // Вход в конденсатор наружного блока
            new THREE.Vector3(2.0, 1.55, -0.3),
            new THREE.Vector3(1.5, 1.55, -0.3),
            new THREE.Vector3(1.35, 1.2, -0.3),
            new THREE.Vector3(1.35, 0.85, -0.3), // Остывание и конденсация в жидкость

            // Выход из конденсатора к ТРВ
            new THREE.Vector3(1.8, 0.75, -0.1),
            new THREE.Vector3(2.25, 0.75, 0.1),  // Точка ТРВ (дросселирование / мгновенный мороз!)

            // Тонкая жидкостная линия через стену
            new THREE.Vector3(1.4, 1.1, 0.05),
            new THREE.Vector3(0.5, 1.65, 0.0),
            new THREE.Vector3(0.0, 1.88, -0.02),
            new THREE.Vector3(-0.6, 2.05, -0.02),
            new THREE.Vector3(-1.1, 2.22, -0.02),

            // Испаритель комнатного блока (кипение ледяного фреона)
            new THREE.Vector3(-1.4, 2.35, -0.1),
            new THREE.Vector3(-1.8, 2.45, 0.0),
            new THREE.Vector3(-1.5, 2.52, 0.05),
            new THREE.Vector3(-1.2, 2.38, 0.0),

            // Толстая всасывающая газовая линия через стену к компрессору
            new THREE.Vector3(-1.0, 2.25, 0.0),
            new THREE.Vector3(-0.4, 2.08, 0.02),
            new THREE.Vector3(0.0, 1.92, 0.03),
            new THREE.Vector3(0.6, 1.68, 0.0),
            new THREE.Vector3(1.5, 1.28, -0.05),
            new THREE.Vector3(2.0, 1.05, -0.05)  // Вход во всасывающий патрубок компрессора
        ];

        this.circuitCurve = new THREE.CatmullRomCurve3(waypoints, true);

        // Создаем систему частиц хладагента
        const particleCount = 280;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        this.refParticleData = [];

        for (let i = 0; i < particleCount; i++) {
            const t = i / particleCount;
            const pt = this.circuitCurve.getPointAt(t);
            positions[i * 3] = pt.x;
            positions[i * 3 + 1] = pt.y;
            positions[i * 3 + 2] = pt.z;

            // Расчет начального цвета в зависимости от участка цикла
            const col = this.getRefrigerantColorAt(t, 'cool');
            colors[i * 3] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;

            sizes[i] = 0.055;

            this.refParticleData.push({
                t: t,
                speed: 0.0025
            });
        }

        const partGeo = new THREE.BufferGeometry();
        partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        partGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        partGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Текстура светящейся точки
        const dotTexture = this.createGlowDotTexture();

        const partMat = new THREE.PointsMaterial({
            size: 0.075,
            vertexColors: true,
            map: dotTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.refParticlesMesh = new THREE.Points(partGeo, partMat);
        this.scene.add(this.refParticlesMesh);
    }

    createGlowDotTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.6, 'rgba(120, 200, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    getRefrigerantColorAt(t, mode) {
        // Термодинамический цвет точки по контуру:
        // t от 0.0 до 0.15: Компрессор -> Горячий газ высокого давления (Красный / Оранжевый)
        // t от 0.15 до 0.32: Конденсатор -> Остывающий газ, переходящий в теплую жидкость (Оранжевый -> Желтый)
        // t от 0.32 до 0.38: ТРВ клапан -> Вспышка дросселирования (Мгновенное охлаждение в яркий Бирюзовый)
        // t от 0.38 до 0.72: Испаритель комнатного блока -> Ледяная жидкость кипит, поглощая тепло (Холодный Синий/Голубой)
        // t от 0.72 до 1.0: Обратная магистраль -> Холодный газ возвращается в компрессор (Глубокий Синий)

        if (mode === 'heat') {
            // В режиме обогрева (Тепловой насос) 4-ходовой клапан реверсирует тепло!
            // Внутренний блок греет комнату (Красный/Оранжевый), а внешний блок охлаждается
            if (t >= 0.38 && t <= 0.72) {
                return new THREE.Color(0xff3b30); // Горячий радиатор в комнате!
            } else if (t >= 0.15 && t <= 0.32) {
                return new THREE.Color(0x00e5ff); // Холодный радиатор на улице!
            } else {
                return new THREE.Color(0xff9500);
            }
        }

        // Обычный режим охлаждения
        if (t >= 0.0 && t < 0.18) {
            return new THREE.Color(0xff2200); // Сильно сжатый раскаленный газ
        } else if (t >= 0.18 && t < 0.32) {
            return new THREE.Color(0xff9500); // Теплая сконденсированная жидкость
        } else if (t >= 0.32 && t < 0.45) {
            return new THREE.Color(0x00ffff); // Мгновенный лед после ТРВ!
        } else if (t >= 0.45 && t < 0.75) {
            return new THREE.Color(0x0284c7); // Испарение и сбор тепла
        } else {
            return new THREE.Color(0x38bdf8); // Холодный пар на всасывание
        }
    }

    setupAirflowParticles() {
        // Визуализация движения воздуха в комнате и на улице
        const count = 120;
        this.airflowIndoor = [];
        this.airflowOutdoor = [];

        const glowTex = this.createGlowDotTexture();

        // 1. Поток холодного воздуха из кондиционера в комнату
        const indoorGeo = new THREE.BufferGeometry();
        const inPositions = new Float32Array(count * 3);
        const inColors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            this.airflowIndoor.push({
                x: -1.6 + (Math.random() - 0.5) * 1.1,
                y: 2.15,
                z: 0.25,
                vx: (Math.random() - 0.5) * 0.005,
                vy: -0.015 - Math.random() * 0.012,
                vz: 0.02 + Math.random() * 0.025,
                life: Math.random(),
                maxLife: 1.0
            });
            inPositions[i * 3] = -1.6;
            inPositions[i * 3 + 1] = 2.15;
            inPositions[i * 3 + 2] = 0.25;

            // Прохладный бирюзовый цвет воздуха
            inColors[i * 3] = 0.2;
            inColors[i * 3 + 1] = 0.85;
            inColors[i * 3 + 2] = 1.0;
        }
        indoorGeo.setAttribute('position', new THREE.BufferAttribute(inPositions, 3));
        indoorGeo.setAttribute('color', new THREE.BufferAttribute(inColors, 3));

        const indoorAirMat = new THREE.PointsMaterial({
            size: 0.09,
            vertexColors: true,
            map: glowTex,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.indoorAirMesh = new THREE.Points(indoorGeo, indoorAirMat);
        this.scene.add(this.indoorAirMesh);

        // 2. Выброс горячего воздуха из наружного блока на улицу
        const outdoorGeo = new THREE.BufferGeometry();
        const outPositions = new Float32Array(count * 3);
        const outColors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            this.airflowOutdoor.push({
                x: 1.6 + (Math.random() - 0.5) * 0.5,
                y: 1.1 + (Math.random() - 0.5) * 0.5,
                z: 0.2,
                vx: (Math.random() - 0.5) * 0.008,
                vy: (Math.random() - 0.5) * 0.008,
                vz: 0.03 + Math.random() * 0.035,
                life: Math.random(),
                maxLife: 1.0
            });
            outPositions[i * 3] = 1.6;
            outPositions[i * 3 + 1] = 1.1;
            outPositions[i * 3 + 2] = 0.2;

            // Горячий оранжевый цвет выбрасываемого тепла
            outColors[i * 3] = 1.0;
            outColors[i * 3 + 1] = 0.45;
            outColors[i * 3 + 2] = 0.1;
        }
        outdoorGeo.setAttribute('position', new THREE.BufferAttribute(outPositions, 3));
        outdoorGeo.setAttribute('color', new THREE.BufferAttribute(outColors, 3));

        const outdoorAirMat = new THREE.PointsMaterial({
            size: 0.11,
            vertexColors: true,
            map: glowTex,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.outdoorAirMesh = new THREE.Points(outdoorGeo, outdoorAirMat);
        this.scene.add(this.outdoorAirMesh);
    }

    setupHotspots() {
        // Интерактивные кликабельные маркеры с бейджами для 8-летнего ребенка
        const hotspotDefinitions = [
            {
                id: 'compressor',
                title: '🫀 Компрессор («Сердце системы»)',
                subtitle: 'Сжимает газ и качает тепло',
                pos: new THREE.Vector3(2.25, 1.25, -0.05),
                camPos: new THREE.Vector3(2.3, 1.45, 1.2),
                target: new THREE.Vector3(2.25, 1.2, -0.05),
                color: '#ef4444',
                desc: 'Компрессор — это самый мощный насос кондиционера! Он работает как велосипедный насос: изо всех сил сжимает газ фреон. От сильного сжатия газ разогревается до +70°C... +90°C и бежит дальше по медным трубкам!'
            },
            {
                id: 'evaporator',
                title: '❄️ Испаритель (Генератор холода в комнате)',
                subtitle: 'Забирает тепло из воздуха комнаты',
                pos: new THREE.Vector3(-1.6, 2.5, 0.0),
                camPos: new THREE.Vector3(-1.6, 2.5, 1.4),
                target: new THREE.Vector3(-1.6, 2.4, 0.0),
                color: '#00e5ff',
                desc: 'Здесь ледяной жидкий фреон бежит по сотням тонких трубок. Теплый воздух из твоей комнаты продувается через них. Фреон жадно впитывает тепло, закипает и улетает в виде пара, а в комнату дует морозный чистый ветерок!'
            },
            {
                id: 'valve',
                title: '🔘 Клапан ТРВ (Магия мгновенного холода)',
                subtitle: 'Превращает горячую жидкость в лед',
                pos: new THREE.Vector3(2.35, 0.75, 0.15),
                camPos: new THREE.Vector3(2.4, 0.9, 0.9),
                target: new THREE.Vector3(2.35, 0.75, 0.15),
                color: '#38bdf8',
                desc: 'Вспомни, как пшикает аэрозольный баллончик: если нажать кнопку, баллончик мгновенно становится ледяным! Клапан делает то же самое: он пропускает фреон сквозь узкую щелочку. Давление резко падает, и фреон моментально остывает до минусовой температуры!'
            },
            {
                id: 'condenser',
                title: '♨️ Конденсатор (Сброс тепла на улицу)',
                subtitle: 'Куда девается тепло из твоей комнаты?',
                pos: new THREE.Vector3(1.65, 1.2, -0.3),
                camPos: new THREE.Vector3(1.6, 1.3, -1.5),
                target: new THREE.Vector3(1.65, 1.2, -0.3),
                color: '#f97316',
                desc: 'Ты замечал, что наружный блок на улице всегда дует горячим воздухом? Это потому, что радиатор-конденсатор отдает улице все тепло, которое кондиционер забрал из твоей комнаты! Горячий пар внутри трубок остывает и превращается обратно в жидкость.'
            },
            {
                id: 'outdoorFan',
                title: '🌪️ Уличный пропеллер (Серповидные лопасти)',
                subtitle: 'Аэродинамика бесшумного сброса тепла',
                pos: new THREE.Vector3(1.62, 1.1, 0.25),
                camPos: new THREE.Vector3(1.62, 1.1, 1.55),
                target: new THREE.Vector3(1.62, 1.1, 0.1),
                color: '#38bdf8',
                desc: 'Посмотри на эти 3 лопасти! Они загнуты назад как серп или крылья быстрых птиц. Такая аэродинамическая крутка позволяет пропеллеру прокачивать тонны воздуха сквозь горячий радиатор почти бесшумно. А круглый диффузор-раструб вокруг направляет поток вперед!'
            },
            {
                id: 'indoorFan',
                title: '🌀 Турбина («Беличье колесо»)',
                subtitle: 'Тихий барабанный вентилятор',
                pos: new THREE.Vector3(-1.6, 2.25, 0.05),
                camPos: new THREE.Vector3(-1.6, 2.2, 1.1),
                target: new THREE.Vector3(-1.6, 2.25, 0.05),
                color: '#a855f7',
                desc: 'Этот вентилятор похож на колесо, в котором бегают хомячки! Он захватывает воздух по всей длине блока и выталкивает его через нижние шторки-жалюзи прямо в комнату — тихо, плавно и без сквозняков.'
            },
            {
                id: 'reversingValve',
                title: '🔄 4-ходовой клапан («Зима / Лето»)',
                subtitle: 'Как кондиционер превращается в обогреватель',
                pos: new THREE.Vector3(2.05, 1.35, -0.05),
                camPos: new THREE.Vector3(2.1, 1.5, 0.9),
                target: new THREE.Vector3(2.05, 1.35, -0.05),
                color: '#eab308',
                desc: 'Это настоящий волшебный стрелочник! Когда ты нажимаешь кнопку «Обогрев», этот клапан перенаправляет поток фреона задом наперед. И кондиционер начинает греть комнату, забирая тепло даже из морозного уличного воздуха!'
            }
        ];

        this.hotspotData = hotspotDefinitions;
        this.hotspotMeshes = [];

        hotspotDefinitions.forEach((def) => {
            const group = new THREE.Group();
            group.position.copy(def.pos);

            // Пульсирующее неоновое кольцо
            const ringGeo = new THREE.RingGeometry(0.04, 0.065, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(def.color),
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            group.add(ring);

            // Центральная светящаяся сфера-кнопка
            const sphereGeo = new THREE.SphereGeometry(0.035, 16, 16);
            const sphereMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(def.color),
                emissive: new THREE.Color(def.color),
                emissiveIntensity: 0.8,
                roughness: 0.2
            });
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.userData = { isHotspot: true, hotspotId: def.id };
            group.add(sphere);

            // Внешнее расширяющееся кольцо для пульсации
            const pulseRingGeo = new THREE.RingGeometry(0.065, 0.085, 32);
            const pulseMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(def.color),
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.5
            });
            const pulseRing = new THREE.Mesh(pulseRingGeo, pulseMat);
            group.add(pulseRing);

            this.scene.add(group);
            this.hotspotMeshes.push({ group, ring, sphere, pulseRing, def });
        });
    }

    onPointerDown(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const clickables = this.hotspotMeshes.map(h => h.sphere);
        const intersects = this.raycaster.intersectObjects(clickables);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            const hotspotId = hit.userData.hotspotId;
            this.selectHotspot(hotspotId);
            return;
        }

        // Проверка клика по Криперу
        if (this.creeperClickables && this.creeperClickables.length > 0) {
            const creeperHits = this.raycaster.intersectObjects(this.creeperClickables);
            if (creeperHits.length > 0) {
                this.onCreeperClicked();
                return;
            }
        }
    }

    selectHotspot(id) {
        const item = this.hotspotData.find(h => h.id === id);
        if (!item) return;

        this.state.activeNodeId = id;

        // Звуковой аккорд
        if (window.soundEngine) {
            window.soundEngine.playChime();
        }

        // Плавный перелет камеры
        this.targetCameraPos = item.camPos.clone();
        this.targetLookAt = item.target.clone();

        // Уведомляем UI
        if (window.onNodeSelected) {
            window.onNodeSelected(item);
        }
    }

    resetCamera() {
        this.state.activeNodeId = null;
        this.targetCameraPos = this.defaultCameraPos.clone();
        this.targetLookAt = this.defaultLookAt.clone();
    }

    setPower(isOn) {
        this.state.power = isOn;
        const fanRpmPresets = [16, 25, 34, 46];

        if (isOn) {
            this.physics.fanRpmTarget = fanRpmPresets[this.state.fanSpeed - 1] || 25;
            this.physics.indoorFanRpmTarget = this.physics.fanRpmTarget * 0.85;
        } else {
            this.physics.fanRpmTarget = 0.0;
            this.physics.indoorFanRpmTarget = 0.0;
        }

        if (window.soundEngine) {
            window.soundEngine.setPower(isOn);
        }
        if (this.displayMesh) {
            this.displayMesh.visible = isOn;
        }
    }

    setMode(mode) {
        // 'cool' | 'heat' | 'fan'
        this.state.mode = mode;
        const color = mode === 'heat' ? '#ff7a00' : (mode === 'fan' ? '#10b981' : '#00e5ff');
        this.updateDisplayText(`${this.state.targetTemp}°C`, color);

        // Обновляем цвета трубок и хладагента
        this.updateMaterialColors();

        // Обновляем бейджи комнаты и улицы
        if (mode === 'heat') {
            this.roomLabelMesh.material.map = this.createFloatingTextBadge("🏠 КОМНАТА (+26°C)", -2.3, 3.9, 0, 0xf97316).material.map;
            this.outdoorLabelMesh.material.map = this.createFloatingTextBadge("❄️ УЛИЦА (+5°C)", 2.3, 3.9, 0, 0x38bdf8).material.map;
        } else {
            this.roomLabelMesh.material.map = this.createFloatingTextBadge("🏠 КОМНАТА (+24°C)", -2.3, 3.9, 0, 0x38bdf8).material.map;
            this.outdoorLabelMesh.material.map = this.createFloatingTextBadge("☀️ УЛИЦА (+32°C)", 2.3, 3.9, 0, 0xf97316).material.map;
        }
    }

    setTargetTemp(temp) {
        this.state.targetTemp = Math.max(16, Math.min(30, temp));
        const color = this.state.mode === 'heat' ? '#ff7a00' : '#00e5ff';
        this.updateDisplayText(`${this.state.targetTemp}°C`, color);

        // Регулировка скорости компрессора в зависимости от разницы температур
        const diff = Math.abs(this.state.targetTemp - 25);
        const speedRatio = 0.8 + diff * 0.12;
        if (window.soundEngine) {
            window.soundEngine.setSpeed(speedRatio);
        }
    }

    setFanSpeed(level) {
        // 1..4 (4 = turbo)
        this.state.fanSpeed = level;
        const ratios = [0.6, 1.0, 1.3, 1.8];
        const fanRpmPresets = [16, 25, 34, 46];

        if (this.state.power) {
            this.physics.fanRpmTarget = fanRpmPresets[level - 1] || 25;
            this.physics.indoorFanRpmTarget = this.physics.fanRpmTarget * 0.85;
        }

        if (window.soundEngine) {
            window.soundEngine.setSpeed(ratios[level - 1] || 1.0);
        }
    }

    toggleXray() {
        this.state.xray = !this.state.xray;
        const targetOpacity = this.state.xray ? 0.32 : 0.95;
        const targetRoughness = this.state.xray ? 0.15 : 0.5;
        const targetTransmission = this.state.xray ? 0.75 : 0.05;

        this.translucentMaterials.forEach(mat => {
            mat.opacity = targetOpacity;
            mat.roughness = targetRoughness;
            mat.transmission = targetTransmission;
            mat.needsUpdate = true;
        });

        return this.state.xray;
    }

    toggleSlowMo() {
        this.state.slowMo = !this.state.slowMo;
        this.state.timeScale = this.state.slowMo ? 0.2 : 1.0;
        return this.state.slowMo;
    }

    updateMaterialColors() {
        const isHeat = this.state.mode === 'heat';

        if (this.evaporatorTubeMat) {
            this.evaporatorTubeMat.color.setHex(isHeat ? 0xff4500 : 0x00f2fe);
            this.evaporatorTubeMat.emissive.setHex(isHeat ? 0xd97706 : 0x0284c7);
        }
        if (this.condenserTubeMat) {
            this.condenserTubeMat.color.setHex(isHeat ? 0x00f2fe : 0xff4500);
            this.condenserTubeMat.emissive.setHex(isHeat ? 0x0284c7 : 0xd97706);
        }

        // Обновляем цвета потоков воздуха
        if (this.indoorAirMesh) {
            const inCols = this.indoorAirMesh.geometry.attributes.color;
            for (let i = 0; i < inCols.count; i++) {
                if (isHeat) {
                    inCols.setXYZ(i, 1.0, 0.45, 0.1); // Теплый воздух в комнату
                } else {
                    inCols.setXYZ(i, 0.2, 0.85, 1.0); // Холодный воздух в комнату
                }
            }
            inCols.needsUpdate = true;
        }

        if (this.outdoorAirMesh) {
            const outCols = this.outdoorAirMesh.geometry.attributes.color;
            for (let i = 0; i < outCols.count; i++) {
                if (isHeat) {
                    outCols.setXYZ(i, 0.2, 0.85, 1.0); // Холодный воздух на улицу
                } else {
                    outCols.setXYZ(i, 1.0, 0.45, 0.1); // Теплый воздух на улицу
                }
            }
            outCols.needsUpdate = true;
        }
    }

    onWindowResize() {
        this.width = this.container.clientWidth || window.innerWidth;
        this.height = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();
        const effectiveDelta = delta * this.state.timeScale;
        const time = this.clock.getElapsedTime();

        // 1. Плавное перемещение камеры при выборе узла
        if (this.targetCameraPos && this.controls) {
            this.camera.position.lerp(this.targetCameraPos, 0.05);
            this.controls.target.lerp(this.targetLookAt, 0.05);
            if (this.camera.position.distanceTo(this.targetCameraPos) < 0.02) {
                this.targetCameraPos = null;
            }
        }

        if (this.controls) {
            this.controls.update();
        }

        // 2. ФИЗИЧЕСКАЯ ИНЕРЦИЯ ВЕНТИЛЯТОРОВ, ПОТОКОВ ВОЗДУХА И ШТОРОК
        if (!this.state.power) {
            // Инерция маховика: экспоненциальное торможение вентиляторов (~3.5 сек)
            const decelRate = 0.88;
            this.physics.fanRpmCurrent = Math.max(0, this.physics.fanRpmCurrent - this.physics.fanRpmCurrent * decelRate * delta);
            this.physics.indoorFanRpmCurrent = Math.max(0, this.physics.indoorFanRpmCurrent - this.physics.indoorFanRpmCurrent * decelRate * delta);

            // Потоки воздуха постепенно растворяются и затухают за ~3 сек
            this.physics.airflowIntensity = Math.max(0, this.physics.airflowIntensity - delta * 0.32);

            // Хладагент плавно замирает в трубках
            this.physics.refrigerantSpeed = Math.max(0, this.physics.refrigerantSpeed - delta * 0.35);

            // Шторка внутреннего блока плавно закрывается вровень с корпусом
            this.physics.louverAngle = Math.max(0, this.physics.louverAngle - delta * 0.28);
        } else {
            // Плавный разгон моторов до рабочих оборотов (~2.5 сек)
            const accelRate = 1.3;
            this.physics.fanRpmCurrent += (this.physics.fanRpmTarget - this.physics.fanRpmCurrent) * accelRate * delta;
            this.physics.indoorFanRpmCurrent += (this.physics.indoorFanRpmTarget - this.physics.indoorFanRpmCurrent) * accelRate * delta;

            // Потоки воздуха нарастают по мере набора оборотов
            this.physics.airflowIntensity = Math.min(1.0, this.physics.airflowIntensity + delta * 0.45);

            // Циркуляция фреона возобновляется
            this.physics.refrigerantSpeed = Math.min(1.0, this.physics.refrigerantSpeed + delta * 0.45);

            // Шторка открывается и начинает плавно покачиваться
            const targetOpen = 0.38 + Math.sin(time * 1.5) * 0.08;
            this.physics.louverAngle += (targetOpen - this.physics.louverAngle) * delta * 1.5;
        }

        // Вращение вентиляторов
        const spinDelta = effectiveDelta;
        if (this.animatedObjects.indoorFan && this.physics.indoorFanRpmCurrent > 0.01) {
            this.animatedObjects.indoorFan.rotation.x -= spinDelta * this.physics.indoorFanRpmCurrent;
        }
        if (this.animatedObjects.outdoorFanRotor && this.physics.fanRpmCurrent > 0.01) {
            this.animatedObjects.outdoorFanRotor.rotation.z += spinDelta * this.physics.fanRpmCurrent;
        }

        // Положение направляющей шторки жалюзи
        if (this.animatedObjects.indoorLouvers) {
            this.animatedObjects.indoorLouvers.rotation.x = this.physics.louverAngle;
        }

        // Вибрация компрессора (пропорциональна текущей скорости)
        if (this.animatedObjects.compressor) {
            const compRatio = Math.min(1.5, this.physics.fanRpmCurrent / 25.0);
            const vib = Math.sin(time * 65) * 0.0015 * compRatio;
            this.animatedObjects.compressor.position.y = -0.08 + vib;
        }

        // 3. Анимация частиц фреона по замкнутому контуру
        if (this.refParticlesMesh && this.circuitCurve && this.physics.refrigerantSpeed > 0.005) {
            const posAttr = this.refParticlesMesh.geometry.attributes.position;
            const colAttr = this.refParticlesMesh.geometry.attributes.color;
            const speedBase = (0.07 + this.state.fanSpeed * 0.04) * this.state.timeScale * this.physics.refrigerantSpeed;

            for (let i = 0; i < this.refParticleData.length; i++) {
                const p = this.refParticleData[i];
                p.t = (p.t + effectiveDelta * speedBase) % 1.0;

                const pt = this.circuitCurve.getPointAt(p.t);
                posAttr.setXYZ(i, pt.x, pt.y, pt.z);

                const c = this.getRefrigerantColorAt(p.t, this.state.mode);
                colAttr.setXYZ(i, c.r, c.g, c.b);
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
        }

        // 4. Анимация потоков воздуха (исчезновение/появление с инерцией)
        const hasAirflow = this.physics.airflowIntensity > 0.008;

        if (this.indoorAirMesh) {
            this.indoorAirMesh.visible = hasAirflow;
            this.indoorAirMesh.material.opacity = 0.65 * this.physics.airflowIntensity;

            if (hasAirflow) {
                const airSpeedMultiplier = (0.8 + this.state.fanSpeed * 0.35) * this.state.timeScale * this.physics.airflowIntensity;
                const inPos = this.indoorAirMesh.geometry.attributes.position;
                for (let i = 0; i < this.airflowIndoor.length; i++) {
                    const ap = this.airflowIndoor[i];
                    ap.life += effectiveDelta * 0.8 * airSpeedMultiplier;
                    if (ap.life > ap.maxLife) {
                        ap.life = 0;
                        ap.x = -1.6 + (Math.random() - 0.5) * 1.0;
                        ap.y = 2.15;
                        ap.z = 0.25;
                    }
                    ap.x += ap.vx * airSpeedMultiplier;
                    ap.y += ap.vy * airSpeedMultiplier;
                    ap.z += ap.vz * airSpeedMultiplier;
                    inPos.setXYZ(i, ap.x, ap.y, ap.z);
                }
                inPos.needsUpdate = true;
            }
        }

        if (this.outdoorAirMesh) {
            this.outdoorAirMesh.visible = hasAirflow;
            this.outdoorAirMesh.material.opacity = 0.70 * this.physics.airflowIntensity;

            if (hasAirflow) {
                const airSpeedMultiplier = (0.9 + this.state.fanSpeed * 0.35) * this.state.timeScale * this.physics.airflowIntensity;
                const outPos = this.outdoorAirMesh.geometry.attributes.position;
                for (let i = 0; i < this.airflowOutdoor.length; i++) {
                    const ap = this.airflowOutdoor[i];
                    ap.life += effectiveDelta * 0.9 * airSpeedMultiplier;
                    if (ap.life > ap.maxLife) {
                        ap.life = 0;
                        ap.x = 1.6 + (Math.random() - 0.5) * 0.45;
                        ap.y = 1.1 + (Math.random() - 0.5) * 0.45;
                        ap.z = 0.18;
                    }
                    ap.x += ap.vx * airSpeedMultiplier;
                    ap.y += ap.vy * airSpeedMultiplier;
                    ap.z += ap.vz * airSpeedMultiplier;
                    outPos.setXYZ(i, ap.x, ap.y, ap.z);
                }
                outPos.needsUpdate = true;
            }
        }

        // 5. Анимация и поворот маркеров к камере
        this.hotspotMeshes.forEach(h => {
            h.group.quaternion.copy(this.camera.quaternion);
            const scale = 1.0 + Math.sin(time * 4) * 0.15;
            h.pulseRing.scale.set(scale, scale, 1);
            h.pulseRing.material.opacity = Math.max(0.05, 0.6 - (scale - 1.0) * 2.0);
        });

        // 6. Анимация Крипера (реакция на климат, дрожь от холода, прыжки и реплики)
        if (this.creeperGroup && this.creeperState) {
            let shiverX = 0;
            let shiverZ = 0;

            if (this.state.power && this.state.mode === 'cool' && this.physics.airflowIntensity > 0.05) {
                // Дрожь от холода в струе кондиционера
                const coldFactor = Math.max(0.3, (30 - this.state.targetTemp) / 14); // 16°C -> 1.0, 30°C -> 0.3
                const shiverIntensity = 0.016 * coldFactor * this.physics.airflowIntensity;
                shiverX = Math.sin(time * 46) * shiverIntensity;
                shiverZ = Math.cos(time * 42) * shiverIntensity;

                // Голова забавно втягивается в плечи и дрожит
                this.creeperHead.rotation.x = 0.12 + Math.sin(time * 44) * 0.04;
                this.creeperHead.rotation.y = 0;
                this.creeperBody.scale.y = 1.0;
            } else if (this.state.power && this.state.mode === 'heat' && this.physics.airflowIntensity > 0.05) {
                // Расслабленное дыхание и наслаждение теплом
                this.creeperHead.rotation.x = -0.06 + Math.sin(time * 2.2) * 0.03;
                this.creeperHead.rotation.y = Math.sin(time * 1.2) * 0.08;
                this.creeperBody.scale.y = 1.0 + Math.sin(time * 2.2) * 0.025;
            } else {
                // Спокойное дыхание / idle
                this.creeperHead.rotation.x = 0;
                this.creeperHead.rotation.y = Math.sin(time * 0.9) * 0.16;
                this.creeperBody.scale.y = 1.0;
            }

            // Анимация прыжка при клике
            let jumpY = 0;
            if (this.creeperState.isJumping) {
                this.creeperState.jumpProgress += delta * 2.6;
                if (this.creeperState.jumpProgress >= 1.0) {
                    this.creeperState.jumpProgress = 0;
                    this.creeperState.isJumping = false;
                } else {
                    const jp = this.creeperState.jumpProgress;
                    jumpY = Math.sin(jp * Math.PI) * 0.32;
                    // Игривый поворот головы при прыжке
                    this.creeperHead.rotation.z = Math.sin(jp * Math.PI * 2) * 0.35;
                }
            } else {
                this.creeperHead.rotation.z = 0;
            }

            this.creeperGroup.position.set(
                this.creeperBasePos.x + shiverX,
                this.creeperBasePos.y + jumpY,
                this.creeperBasePos.z + shiverZ
            );

            // Анимация облачка реплик над головой
            if (this.speechBubbleSprite) {
                if (this.creeperState.bubbleTimer > 0) {
                    this.creeperState.bubbleTimer -= delta;
                    const opacity = Math.min(1.0, this.creeperState.bubbleTimer * 1.8);
                    this.speechBubbleSprite.material.opacity = opacity;
                    this.speechBubbleSprite.visible = true;
                } else {
                    this.speechBubbleSprite.visible = false;
                    this.speechBubbleSprite.material.opacity = 0;
                }
            }
        }

        // 7. Рендеринг сцены
        this.renderer.render(this.scene, this.camera);
    }

    createFallbackControls() {
        const camera = this.camera;
        const domElement = this.renderer.domElement;
        const target = this.cameraTarget;

        const controls = {
            target: target,
            enableDamping: true,
            dampingFactor: 0.08,
            minDistance: 1.5,
            maxDistance: 20,
            maxPolarAngle: Math.PI / 2 + 0.05,
            update: () => {}
        };

        let isDown = false;
        let prevX = 0, prevY = 0;
        let theta = 0;
        let phi = Math.PI / 2.6;
        let radius = camera.position.distanceTo(target);

        const offset = camera.position.clone().sub(target);
        radius = offset.length();
        theta = Math.atan2(offset.x, offset.z);
        phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

        let targetTheta = theta;
        let targetPhi = phi;
        let targetRadius = radius;

        domElement.addEventListener('pointerdown', (e) => {
            isDown = true;
            prevX = e.clientX;
            prevY = e.clientY;
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDown) return;
            const dx = e.clientX - prevX;
            const dy = e.clientY - prevY;
            prevX = e.clientX;
            prevY = e.clientY;

            targetTheta -= dx * 0.005;
            targetPhi -= dy * 0.005;
            targetPhi = Math.max(0.1, Math.min(controls.maxPolarAngle, targetPhi));
        });

        window.addEventListener('pointerup', () => { isDown = false; });
        window.addEventListener('pointercancel', () => { isDown = false; });

        domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            targetRadius += e.deltaY * 0.005;
            targetRadius = Math.max(controls.minDistance, Math.min(controls.maxDistance, targetRadius));
        }, { passive: false });

        controls.update = () => {
            theta += (targetTheta - theta) * controls.dampingFactor;
            phi += (targetPhi - phi) * controls.dampingFactor;
            radius += (targetRadius - radius) * controls.dampingFactor;

            camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
            camera.position.y = target.y + radius * Math.cos(phi);
            camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
            camera.lookAt(target);
        };

        return controls;
    }
}

window.ACScene = ACScene;
