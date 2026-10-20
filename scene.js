// scene.js - 3D Визуализация Сплит-системы Кондиционера на Three.js

const AC_MODELS = {
    lg_cassette: {
        id: 'lg_cassette',
        name: 'LG Cassette Dual Fan',
        brand: 'LG',
        remoteName: 'LG MULTI V CASSETTE',
        type: 'cassette',
        fanDirection: 1, // CCW (против часовой стрелки для обоих уличных пропеллеров)
        indoorPlasticColor: 0xffffff,
        indoorPlasticRoughness: 0.16,
        indoorPlasticMetalness: 0.04,
        indoorLouverColor: 0xffffff,
        indoorSlotColor: 0x334155
    },
    lg: {
        id: 'lg',
        name: 'LG Dual Inverter',
        brand: 'LG',
        remoteName: 'LG DUAL INVERTER',
        fanDirection: 1, // CCW (против часовой стрелки)
        indoorPlasticColor: 0x2b313a, // Темный графит / антрацит
        indoorPlasticRoughness: 0.25,
        indoorPlasticMetalness: 0.15,
        indoorLouverColor: 0x242a32,
        indoorSlotColor: 0x475569
    },
    samsung: {
        id: 'samsung',
        name: 'Samsung WindFree',
        brand: 'Samsung',
        remoteName: 'SAMSUNG WINDFREE',
        fanDirection: -1, // CW (по часовой стрелке)
        indoorPlasticColor: 0x181a1d, // Глубокий матовый черный WindFree
        indoorPlasticRoughness: 0.35,
        indoorPlasticMetalness: 0.08,
        indoorLouverColor: 0x141618,
        indoorSlotColor: 0x334155
    },
    kentatsu: {
        id: 'kentatsu',
        name: 'Kentatsu Yuki',
        brand: 'Kentatsu',
        remoteName: 'KENTATSU YUKI',
        fanDirection: 1, // CCW (против часовой стрелки)
        indoorPlasticColor: 0xffffff, // Белоснежный глянец
        indoorPlasticRoughness: 0.18,
        indoorPlasticMetalness: 0.05,
        indoorLouverColor: 0xffffff,
        indoorSlotColor: 0x94a3b8
    },
    ballu: {
        id: 'ballu',
        name: 'Ballu Eco Smart',
        brand: 'Ballu',
        remoteName: 'BALLU ECO SMART',
        fanDirection: 1, // CCW (против часовой стрелки)
        indoorPlasticColor: 0xffffff, // Белоснежный
        indoorPlasticRoughness: 0.18,
        indoorPlasticMetalness: 0.05,
        indoorLouverColor: 0xffffff,
        indoorSlotColor: 0x94a3b8
    },
    midea: {
        id: 'midea',
        name: 'Midea Blanc',
        brand: 'Midea',
        remoteName: 'MIDEA BLANC',
        fanDirection: 1, // CCW (против часовой стрелки)
        indoorPlasticColor: 0xffffff, // Белоснежный глянец
        indoorPlasticRoughness: 0.16,
        indoorPlasticMetalness: 0.04,
        indoorLouverColor: 0xffffff,
        indoorSlotColor: 0x94a3b8
    },
    mitsubishi: {
        id: 'mitsubishi',
        name: 'Mitsubishi Electric Design',
        brand: 'Mitsubishi',
        remoteName: 'MITSUBISHI ELECTRIC',
        fanDirection: -1, // CW (по часовой стрелке)
        indoorPlasticColor: 0x828892, // Металлический серебристый титан
        indoorPlasticRoughness: 0.24,
        indoorPlasticMetalness: 0.42,
        indoorLouverColor: 0x69707b,
        indoorSlotColor: 0x334155
    },
    energolux: {
        id: 'energolux',
        name: 'Energolux Basel',
        brand: 'Energolux',
        remoteName: 'ENERGOLUX BASEL',
        fanDirection: -1, // CW (по часовой стрелке)
        indoorPlasticColor: 0xffffff, // Белоснежный
        indoorPlasticRoughness: 0.18,
        indoorPlasticMetalness: 0.04,
        indoorLouverColor: 0xffffff,
        indoorSlotColor: 0x94a3b8
    }
};

class ACScene {
    constructor(container) {
        this.container = container;
        this.width = container.clientWidth || window.innerWidth;
        this.height = container.clientHeight || window.innerHeight;

        // Текущая выбранная модель кондиционера
        this.currentModelId = 'lg';
        this.currentModel = AC_MODELS['lg'];

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
            solidIndoorLouver: null,
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

        // Состояние пасхалки взрыва и обломков
        this.cameraShakeIntensity = 0;
        this.cameraShakeTimer = 0;
        this.debrisList = [];
        this.explosionParticles = [];
        this.electricSparks = [];
        this.sparkTimer = 0;
        this.flickerTimer = 0;
        this.isACDestroyed = false;
        this.isRestoring = false;
        this.restoreProgress = 0;

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
        this.buildCassetteIndoorUnit();
        this.buildDualFanOutdoorUnit();
        this.buildCassettePiping();
        this.buildCassetteAirflow();
        this.buildCreeper();
        this.setupRefrigerantCircuit();
        this.setupAirflowParticles();
        this.setupHotspots();

        // 5. Обработка кликов и ресайза
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.onWindowResize(), 150));
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

        // Разборная стена из 16 бетонных блоков (сетка 4x4)
        this.wallBlocks = [];
        const wallRows = 4;
        const wallCols = 4;
        const totalWallH = 4.5;
        const totalWallD = 5.0;
        const blockW = 0.35;
        const blockH = totalWallH / wallRows; // 1.125м
        const blockD = totalWallD / wallCols; // 1.25м

        const blockGeo = new THREE.BoxGeometry(blockW, blockH - 0.006, blockD - 0.006);
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x1f293d,
            roughness: 0.8,
            metalness: 0.1
        });

        for (let r = 0; r < wallRows; r++) {
            for (let c = 0; c < wallCols; c++) {
                const block = new THREE.Mesh(blockGeo, wallMat);
                // От Y = -0.25 до Y = 4.25 (центр Y = 2.0)
                const py = -0.25 + (r + 0.5) * blockH;
                // От Z = -2.5 до Z = 2.5 (центр Z = 0)
                const pz = -2.5 + (c + 0.5) * blockD;
                block.position.set(0, py, pz);
                block.receiveShadow = true;
                block.castShadow = true;
                wallGroup.add(block);
                this.wallBlocks.push(block);
            }
        }

        // Декоративный срез стены из 4 неоновых сегментов
        this.wallTrimBlocks = [];
        const trimSegH = 4.52 / wallRows;
        const trimGeo = new THREE.BoxGeometry(0.37, trimSegH - 0.006, 0.1);
        const trimMat = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x1d4ed8,
            emissiveIntensity: 0.2
        });
        for (let r = 0; r < wallRows; r++) {
            const trimMesh = new THREE.Mesh(trimGeo, trimMat);
            trimMesh.position.set(0, -0.25 + (r + 0.5) * blockH, 2.5);
            wallGroup.add(trimMesh);
            this.wallTrimBlocks.push(trimMesh);
        }

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
        this.wallSleeveMesh = sleeve;

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
        this.indoorBackPlate = backPlate;

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
        this.indoorFanMotor = fanMotor;

        // Подшипниковый узел в левом торце
        const bearingGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16);
        bearingGeo.rotateZ(Math.PI / 2);
        const bearing = new THREE.Mesh(bearingGeo, new THREE.MeshStandardMaterial({ color: 0x475569 }));
        bearing.position.set(-fanLength / 2 - 0.025, -0.14, 0.03);
        indoorGroup.add(bearing);
        this.indoorBearing = bearing;

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
        this.indoorTopGrill = grill;

        // Реалистичный сплошной корпус Ballu Eco Smart
        this.buildIndoorSolidCasing(indoorGroup, width, height, depth);

        this.indoorGroup = indoorGroup;
        this.scene.add(indoorGroup);
    }

    // ----------------------------------------------------
    // РЕАЛИСТИЧНЫЙ КОРПУС ВНУТРЕННЕГО БЛОКА (LG, SAMSUNG, KENTATSU, BALLU)
    // ----------------------------------------------------
    buildIndoorBalluFasciaTexture() {
        this.buildIndoorFasciaTexture();
    }

    buildIndoorFasciaTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        this.indoorFasciaCanvas = canvas;
        this.indoorFasciaCtx = ctx;

        const texture = new THREE.CanvasTexture(canvas);
        this.indoorFasciaTexture = texture;

        this.updateIndoorFasciaDisplay();
    }

        drawMitsubishiLogo(ctx, cx, cy, size = 28) {
        ctx.save();
        ctx.fillStyle = '#e60012'; // Фирменный красный цвет Mitsubishi
        // Три ромба под углом 120 градусов, сходящиеся в центральной точке (cx, cy)
        for (let i = 0; i < 3; i++) {
            const baseAngle = -Math.PI / 2 + (i * 2 * Math.PI / 3);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const p1x = cx + Math.cos(baseAngle - Math.PI / 6) * size;
            const p1y = cy + Math.sin(baseAngle - Math.PI / 6) * size;
            const tipX = cx + Math.cos(baseAngle) * size * Math.sqrt(3);
            const tipY = cy + Math.sin(baseAngle) * size * Math.sqrt(3);
            const p2x = cx + Math.cos(baseAngle + Math.PI / 6) * size;
            const p2y = cy + Math.sin(baseAngle + Math.PI / 6) * size;
            ctx.lineTo(p1x, p1y);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(p2x, p2y);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    drawEnergoluxLogo(ctx, cx, cy, fontSize = 32) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
        const text = 'Energolu';
        const textMetrics = ctx.measureText(text);
        const textW = textMetrics.width;

        ctx.fillStyle = '#1e293b';
        ctx.fillText(text, cx, cy);

        // Красный квадратик со стилизованной буквой 'x'
        const sqSize = fontSize * 0.88;
        const sqX = cx + textW + 4;
        const sqY = cy - sqSize / 2;
        const r = sqSize * 0.2;

        ctx.fillStyle = '#e11d48'; // Energolux red
        ctx.beginPath();
        this.drawRoundRect(ctx, sqX, sqY, sqSize, sqSize, r);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = sqSize * 0.22;
        ctx.lineCap = 'round';
        const pad = sqSize * 0.26;
        ctx.beginPath();
        ctx.moveTo(sqX + pad, sqY + pad);
        ctx.lineTo(sqX + sqSize - pad, sqY + sqSize - pad);
        ctx.moveTo(sqX + sqSize - pad, sqY + pad);
        ctx.lineTo(sqX + pad, sqY + sqSize - pad);
        ctx.stroke();

        ctx.restore();
    }

    drawMideaLogo(ctx, cx, cy, fontSize = 36, textColor = '#0091d5') {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText('Midea', cx, cy);

        // Фирменная дуга/ореол над логотипом Midea
        ctx.strokeStyle = textColor;
        ctx.lineWidth = Math.max(2.5, fontSize * 0.08);
        ctx.beginPath();
        ctx.arc(cx - fontSize * 0.38, cy - fontSize * 0.48, fontSize * 0.22, -Math.PI * 0.85, Math.PI * 0.15);
        ctx.stroke();

        ctx.restore();
    }

    drawKentatsuIcon(ctx, cx, cy, radius = 18) {
        ctx.save();
        ctx.fillStyle = '#d9252a';
        const petalSize = radius * 0.45;
        const dist = radius * 0.70;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);
            ctx.fillRect(-petalSize / 2, -petalSize / 2, petalSize, petalSize);
            ctx.restore();
        }
        ctx.restore();
    }

    drawRoundRect(ctx, x, y, width, height, radius) {
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, width, height, radius);
        } else {
            const r = Math.min(radius, width / 2, height / 2);
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + r);
            ctx.lineTo(x + width, y + height - r);
            ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            ctx.lineTo(x + r, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
        }
    }

    updateIndoorBalluDisplay() {
        this.updateIndoorFasciaDisplay();
    }

    updateIndoorFasciaDisplay() {
        if (!this.indoorFasciaCtx) return;
        const ctx = this.indoorFasciaCtx;
        const w = 1024;
        const h = 512;
        const modelId = this.currentModelId || 'lg';

        ctx.clearRect(0, 0, w, h);

        if (modelId === 'lg') {
            // ТЕМНЫЙ ГРАФИТ LG DUAL INVERTER
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#2b313a');
            grad.addColorStop(0.5, '#353c46');
            grad.addColorStop(1, '#22272e');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Мягкий горизонтальный металлический блик
            const hlGrad = ctx.createLinearGradient(0, 120, 0, 220);
            hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            hlGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.06)');
            hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = hlGrad;
            ctx.fillRect(0, 120, w, 100);

            // Тонкая разделительная фаска над шторкой
            ctx.strokeStyle = '#1a1f26';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(25, h - 35);
            ctx.lineTo(w - 25, h - 35);
            ctx.stroke();

            // Эмблема LG по центру (круг с L-G лицом)
            const cx = w / 2;
            const cy = h / 2 - 12;
            const r = 24;

            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();

            // G контур внутри
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.65, -Math.PI * 0.75, Math.PI * 0.65);
            ctx.stroke();

            // L носик внутри
            ctx.beginPath();
            ctx.moveTo(cx - 3, cy - 8);
            ctx.lineTo(cx - 3, cy + 4);
            ctx.lineTo(cx + 5, cy + 4);
            ctx.stroke();

            // Глаз-точка
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(cx - 8, cy - 4, 2.2, 0, Math.PI * 2);
            ctx.fill();

            // Надпись LG под эмблемой
            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('LG', cx, cy + r + 6);

            // Надпись DUAL Inverter справа внизу
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('DUAL Inverter', w - 80, h - 65);

            // LED Дисплей (светящиеся голубые цифры температуры)
            if (this.isACDestroyed) {
                this.drawDamagedDisplay(ctx, 'lg', w, h);
            } else if (this.state.power) {
                const tempStr = `${this.state.targetTemp}°`;
                ctx.save();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 74px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.shadowColor = '#00e5ff';
                ctx.shadowBlur = 20;
                ctx.fillStyle = '#38bdf8';
                ctx.fillText(tempStr, w - 85, h / 2 - 25);
                ctx.restore();
            }

        } else if (modelId === 'samsung') {
            // ГЛУБОКИЙ ЧЕРНЫЙ МАТОВЫЙ SAMSUNG WINDFREE
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#14171a');
            grad.addColorStop(0.5, '#1d2126');
            grad.addColorStop(1, '#111316');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Микроперфорация WindFree (сетка микроотверстий)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
            for (let py = 45; py < h - 50; py += 12) {
                const rowShift = ((py / 12) % 2 === 0) ? 0 : 6;
                for (let px = 40 + rowShift; px < w - 40; px += 12) {
                    ctx.beginPath();
                    ctx.arc(px, py, 1.4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Фаска над нижней шторкой
            ctx.strokeStyle = '#0f1114';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(25, h - 35);
            ctx.lineTo(w - 25, h - 35);
            ctx.stroke();

            // Логотип SAMSUNG вверху слева
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('SAMSUNG', 70, 50);

            // Надпись WindFree™ вверху справа
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('WindFree™', w - 70, 52);

            // Цифровой LED дисплей Samsung на затемненной мини-панели внизу справа
            if (this.isACDestroyed) {
                this.drawDamagedDisplay(ctx, 'samsung', w, h);
            } else if (this.state.power) {
                const tempStr = `${this.state.targetTemp}°`;
                const bx = w - 165, by = h - 110, bw = 100, bh = 50;
                ctx.fillStyle = '#0a0c0e';
                ctx.beginPath();
                this.drawRoundRect(ctx, bx, by, bw, bh, 8);
                ctx.fill();
                ctx.strokeStyle = '#272d36';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", monospace';
                ctx.shadowColor = '#00e5ff';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#38bdf8';
                ctx.fillText(tempStr, bx + bw / 2, by + bh / 2 + 1);
                ctx.restore();
            }

        } else if (modelId === 'kentatsu') {
            // БЕЛОСНЕЖНЫЙ КОРПУС KENTATSU YUKI
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);

            const topGrad = ctx.createLinearGradient(0, 0, 0, 60);
            topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
            topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, w, 60);

            const botGrad = ctx.createLinearGradient(0, h - 50, 0, h);
            botGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            botGrad.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
            ctx.fillStyle = botGrad;
            ctx.fillRect(0, h - 50, w, 50);

            // Тонкая фаска
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(25, h - 35);
            ctx.lineTo(w - 25, h - 35);
            ctx.stroke();

            // Эмблема Kentatsu (красная 8-лепестковая снежинка) + надпись
            const kx = 100, ky = h - 68;
            this.drawKentatsuIcon(ctx, kx, ky, 18);

            ctx.fillStyle = '#1e293b';
            ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('KENTATSU', kx + 22, ky);

            // Надпись YUKI INVERTER
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('YUKI INVERTER', w - 75, h - 68);

            // LED Дисплей
            if (this.isACDestroyed) {
                this.drawDamagedDisplay(ctx, 'kentatsu', w, h);
            } else if (this.state.power) {
                const tempStr = `${this.state.targetTemp}°`;
                ctx.save();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 74px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 18;
                ctx.fillStyle = '#0ea5e9';
                ctx.fillText(tempStr, w - 85, h / 2 - 25);
                ctx.restore();
            }

                } else if (modelId === 'midea') {
            // БЕЛОСНЕЖНЫЙ ГЛЯНЦЕВЫЙ MIDEA BLANC
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.5, '#f8fafc');
            grad.addColorStop(1, '#f1f5f9');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Мягкий горизонтальный световой блик
            const hlGrad = ctx.createLinearGradient(0, 80, 0, 180);
            hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            hlGrad.addColorStop(0.5, 'rgba(0, 145, 213, 0.05)');
            hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = hlGrad;
            ctx.fillRect(0, 80, w, 100);

            // Тонкая разделительная фаска над жалюзи
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(25, h - 35);
            ctx.lineTo(w - 25, h - 35);
            ctx.stroke();

            // Логотип Midea внизу слева
            this.drawMideaLogo(ctx, 110, h - 68, 38, '#0091d5');

            // Надпись FULL DC INVERTER внизу справа
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('FULL DC INVERTER', w - 80, h - 68);

            // LED Дисплей (голубые цифры температуры, просвечивающие сквозь пластик)
            if (this.isACDestroyed) {
                this.drawDamagedDisplay(ctx, 'midea', w, h);
            } else if (this.state.power) {
                const tempStr = `${this.state.targetTemp}°`;
                ctx.save();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 74px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.shadowColor = '#00a2e8';
                ctx.shadowBlur = 20;
                ctx.fillStyle = '#0091d5';
                ctx.fillText(tempStr, w - 85, h / 2 - 25);
                ctx.restore();
            }

        } else if (modelId === 'mitsubishi') {
            // ПРЕМИАЛЬНЫЙ ТИТАНОВЫЙ МЕТАЛЛИК MITSUBISHI ELECTRIC DESIGN
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#6d7481');
            grad.addColorStop(0.35, '#8c94a2');
            grad.addColorStop(0.5, '#9da5b3');
            grad.addColorStop(0.65, '#828997');
            grad.addColorStop(1, '#5f6572');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Металлический горизонтальный блик
            const hlGrad = ctx.createLinearGradient(0, 110, 0, 210);
            hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            hlGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
            hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = hlGrad;
            ctx.fillRect(0, 110, w, 100);

            // Строгая тонкая разделительная фаска
            ctx.strokeStyle = '#4b5260';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(25, h - 35);
            ctx.lineTo(w - 25, h - 35);
            ctx.stroke();

            // Красная эмблема Mitsubishi по центру
            this.drawMitsubishiLogo(ctx, w / 2, h / 2 - 14, 22);

            // Надпись MITSUBISHI ELECTRIC под эмблемой
            ctx.fillStyle = '#1e242d';
            ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('MITSUBISHI ELECTRIC', w / 2, h / 2 + 16);

            // Лаконичный серебристо-белый LED дисплей справа
            if (this.isACDestroyed) {
                this.drawDamagedDisplay(ctx, 'mitsubishi', w, h);
            } else if (this.state.power) {
                const tempStr = `${this.state.targetTemp}°`;
                ctx.save();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 18;
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(tempStr, w - 85, h / 2 - 25);
                ctx.restore();
            }

        } else if (modelId === 'energolux') {
            // ЭЛЕГАНТНЫЙ БЕЛЫЙ КОРПУС ENERGOLUX BASEL
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.5, '#fbfcfe');
            grad.addColorStop(1, '#f1f5f9');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Разделительная фаска над жалюзи
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(25, h - 35);
            ctx.lineTo(w - 25, h - 35);
            ctx.stroke();

            // Логотип Energolux по центру внизу
            const logoW = 180;
            this.drawEnergoluxLogo(ctx, w / 2 - logoW / 2, h - 68, 28);

            // Надпись SWISS DESIGN слева внизу
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('SWISS DESIGN', 75, h - 68);

            // Надпись DC INVERTER справа внизу
            ctx.textAlign = 'right';
            ctx.fillText('DC INVERTER', w - 75, h - 68);

            // Скрытый мягкий LED дисплей по центру (фирменная фишка Energolux)
            if (this.isACDestroyed) {
                this.drawDamagedDisplay(ctx, 'energolux', w, h);
            } else if (this.state.power) {
                const tempStr = `${this.state.targetTemp}°`;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 76px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 20;
                ctx.fillStyle = '#0284c7';
                ctx.fillText(tempStr, w / 2, h / 2 - 25);
                ctx.restore();
            }

        } else {
            // BALLU ECO SMART (оригинальный)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);

            const topGrad = ctx.createLinearGradient(0, 0, 0, 60);
            topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
            topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, w, 60);

            const botGrad = ctx.createLinearGradient(0, h - 50, 0, h);
            botGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            botGrad.addColorStop(1, 'rgba(0, 0, 0, 0.06)');
            ctx.fillStyle = botGrad;
            ctx.fillRect(0, h - 50, w, 50);

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(25, h - 35);
            ctx.lineTo(w - 25, h - 35);
            ctx.stroke();

            // Логотип Ballu по центру
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Ballu', w / 2, h / 2 + 10);

            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('HOME', w / 2 + 76, h / 2 - 6);

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('ECO SMART', 75, h - 65);

            ctx.textAlign = 'right';
            ctx.fillText('DC INVERTER', w - 75, h - 65);

            if (this.isACDestroyed) {
                this.drawDamagedDisplay(ctx, 'ballu', w, h);
            } else if (this.state.power) {
                const tempStr = `${this.state.targetTemp}°`;
                ctx.save();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 74px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 18;
                ctx.fillStyle = '#ffffff';
                ctx.fillText(tempStr, w - 85, h / 2 - 25);
                ctx.restore();
            }
        }

        if (this.indoorFasciaTexture) {
            this.indoorFasciaTexture.needsUpdate = true;
        }
    }

    drawDamagedDisplay(ctx, modelId, w, h) {
        let cx, cy, fontSize;
        if (modelId === 'samsung') {
            const bx = w - 165, by = h - 110, bw = 100, bh = 50;
            cx = bx + bw / 2;
            cy = by + bh / 2 + 1;
            fontSize = 32;

            // Затемненная рамочка дисплея Samsung с повреждениями
            ctx.fillStyle = '#0a0c0e';
            ctx.beginPath();
            this.drawRoundRect(ctx, bx, by, bw, bh, 8);
            ctx.fill();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (modelId === 'energolux') {
            cx = w / 2;
            cy = h / 2 - 25;
            fontSize = 72;
        } else {
            // Для LG, Kentatsu, Ballu, Midea, Mitsubishi центрируем по области LED индикатора (w - 145)
            cx = w - 145;
            cy = h / 2 - 25;
            fontSize = 72;
        }

        // 1. Обугленное пятно (копоть от электрического взрыва)
        const scorchR = modelId === 'samsung' ? 65 : 110;
        const scorch = ctx.createRadialGradient(cx, cy, 10, cx, cy, scorchR);
        scorch.addColorStop(0, 'rgba(12, 12, 14, 0.95)');
        scorch.addColorStop(0.35, 'rgba(40, 25, 20, 0.75)');
        scorch.addColorStop(0.75, 'rgba(60, 40, 30, 0.35)');
        scorch.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = scorch;
        ctx.beginPath();
        ctx.arc(cx, cy, scorchR, 0, Math.PI * 2);
        ctx.fill();

        // 2. Мерцающий поврежденный индикатор (ошибки 'Er', 'E1', '--', '8-')
        const errorCodes = ['Er', 'E1', '--', '8-', 'Er'];
        const errText = errorCodes[Math.floor(Math.random() * errorCodes.length)];
        const isFlickerOn = this.isInitialExplosionFrame ? true : (Math.random() > 0.12);

        if (isFlickerOn) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", monospace`;
            ctx.shadowColor = Math.random() > 0.4 ? '#ef4444' : '#00e5ff';
            ctx.shadowBlur = 18;
            ctx.fillStyle = Math.random() > 0.4 ? '#f87171' : '#38bdf8';
            ctx.fillText(errText, cx, cy);
            ctx.restore();
        }

        // 3. Звездчатая паутина трещин на защитном стекле индикатора
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Радиальные изломанные лучи трещин
        const angles = [0.15, 0.65, 1.35, 2.1, 2.85, 3.6, 4.4, 5.2, 5.9];
        angles.forEach(baseAngle => {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            let curX = cx;
            let curY = cy;
            const segments = 3 + Math.floor(Math.random() * 3);
            let segDist = 12 + Math.random() * 10;

            for (let s = 0; s < segments; s++) {
                const devAngle = baseAngle + (Math.sin(s * 1.7) * 0.4);
                curX += Math.cos(devAngle) * segDist;
                curY += Math.sin(devAngle) * segDist;
                ctx.lineTo(curX, curY);

                if (s === 1 && Math.random() > 0.3) {
                    const branchAng = devAngle + (Math.random() > 0.5 ? 0.7 : -0.7);
                    const bx2 = curX + Math.cos(branchAng) * (segDist * 0.7);
                    const by2 = curY + Math.sin(branchAng) * (segDist * 0.7);
                    ctx.moveTo(curX, curY);
                    ctx.lineTo(bx2, by2);
                    ctx.moveTo(curX, curY);
                }
            }
            ctx.stroke();
        });

        // Концентрические кольца трещин вокруг эпицентра
        const rings = modelId === 'samsung' ? [15, 28, 42] : [24, 48, 72];
        rings.forEach(r => {
            ctx.beginPath();
            ctx.arc(cx, cy, r, Math.random() * Math.PI, Math.random() * Math.PI + Math.PI * 0.85);
            ctx.stroke();
        });

        ctx.restore();
    }

    buildIndoorSolidCasing(indoorGroup, width, height, depth) {
        this.indoorSolidCasing = new THREE.Group();

        // Создаем текстуру панели
        this.buildIndoorFasciaTexture();

        const curModel = this.currentModel || AC_MODELS['lg'];

        this.indoorPlasticMat = new THREE.MeshStandardMaterial({
            color: curModel.indoorPlasticColor,
            roughness: curModel.indoorPlasticRoughness ?? 0.18,
            metalness: curModel.indoorPlasticMetalness ?? 0.05
        });

        this.indoorSlotMat = new THREE.MeshStandardMaterial({
            color: curModel.indoorSlotColor ?? 0x94a3b8,
            roughness: 0.6
        });

        // 1. Задняя стенка корпуса
        const backGeo = new THREE.BoxGeometry(width * 0.99, height * 0.98, 0.02);
        const backMesh = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 }));
        backMesh.position.set(0, 0, -depth / 2 + 0.01);
        this.indoorSolidCasing.add(backMesh);

        // 2. Верхняя крышка с решеткой забора воздуха
        const topGeo = new THREE.BoxGeometry(width * 0.98, 0.02, depth * 0.88);
        const topMesh = new THREE.Mesh(topGeo, this.indoorPlasticMat);
        topMesh.position.set(0, height / 2 - 0.01, -0.02);
        this.indoorSolidCasing.add(topMesh);

        for (let i = 0; i < 9; i++) {
            const slotGeo = new THREE.BoxGeometry(width * 0.86, 0.005, 0.018);
            const slot = new THREE.Mesh(slotGeo, this.indoorSlotMat);
            slot.position.set(0, height / 2 + 0.002, -depth * 0.35 + i * 0.035);
            this.indoorSolidCasing.add(slot);
        }

        // 3. Боковые обтекатели
        const sideGeo = new THREE.BoxGeometry(0.02, height * 0.96, depth * 0.92);
        const leftSide = new THREE.Mesh(sideGeo, this.indoorPlasticMat);
        leftSide.position.set(-width / 2 + 0.01, 0, 0);
        const rightSide = new THREE.Mesh(sideGeo, this.indoorPlasticMat);
        rightSide.position.set(width / 2 - 0.01, 0, 0);
        this.indoorSolidCasing.add(leftSide);
        this.indoorSolidCasing.add(rightSide);

        // 4. Дно корпуса
        const botGeo = new THREE.BoxGeometry(width * 0.98, 0.02, depth * 0.82);
        const botMesh = new THREE.Mesh(botGeo, this.indoorPlasticMat);
        botMesh.position.set(0, -height / 2 + 0.01, -0.04);
        this.indoorSolidCasing.add(botMesh);

        // 5. Выпуклая передняя панель с текстурой модели и скрытым LED-дисплеем
        const frontGeo = new THREE.PlaneGeometry(width * 0.99, height * 0.78);
        const frontMat = new THREE.MeshStandardMaterial({
            map: this.indoorFasciaTexture,
            roughness: 0.16,
            metalness: 0.04,
            side: THREE.DoubleSide
        });
        const frontMesh = new THREE.Mesh(frontGeo, frontMat);
        frontMesh.position.set(0, 0.05, depth / 2 + 0.005);
        frontMesh.rotation.x = -0.04;
        this.indoorSolidCasing.add(frontMesh);
        this.indoorFrontMesh = frontMesh;

        // 6. Подвижная моторизованная шторка жалюзи в нижней части
        const louverPivot = new THREE.Group();
        louverPivot.position.set(0, -height / 2 + 0.05, depth / 2 - 0.04);

        const louverGeo = new THREE.BoxGeometry(width * 0.94, 0.018, 0.14);
        this.indoorLouverMat = new THREE.MeshStandardMaterial({
            color: curModel.indoorLouverColor,
            roughness: 0.18,
            metalness: 0.05
        });
        const louverMesh = new THREE.Mesh(louverGeo, this.indoorLouverMat);
        louverMesh.position.set(0, 0, 0.07);
        louverPivot.add(louverMesh);

        this.indoorSolidCasing.add(louverPivot);
        this.animatedObjects.solidIndoorLouver = louverPivot;

        // По умолчанию видимость выключена (так как активен режим Рентген)
        this.indoorSolidCasing.visible = !this.state.xray;
        indoorGroup.add(this.indoorSolidCasing);
    }

    createDigitalDisplay(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        this.displayCanvas = canvas;
        this.displayCtx = ctx;

        const texture = new THREE.CanvasTexture(canvas);
        this.displayTexture = texture;

        this.updateDigitalDisplay(text);

        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const geo = new THREE.PlaneGeometry(0.28, 0.14);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = this.state.xray && (this.state.power || this.isACDestroyed);
        return mesh;
    }

    updateDigitalDisplay(customText) {
        if (!this.displayCtx) return;
        const ctx = this.displayCtx;
        const w = 256;
        const h = 128;

        if (this.isACDestroyed) {
            this.drawDamagedDigitalDisplay(ctx, w, h);
            if (this.displayMesh) {
                this.displayMesh.visible = this.state.xray;
            }
            return;
        }

        if (!this.state.power) {
            ctx.clearRect(0, 0, w, h);
            if (this.displayTexture) {
                this.displayTexture.needsUpdate = true;
            }
            if (this.displayMesh) {
                this.displayMesh.visible = false;
            }
            return;
        }

        const mode = this.state.mode || 'cool';
        const color = mode === 'heat' ? '#ff7a00' : (mode === 'fan' ? '#10b981' : '#00e5ff');
        const text = customText || `${this.state.targetTemp}°C`;

        this.updateDisplayText(text, color);
        if (this.displayMesh) {
            this.displayMesh.visible = this.state.xray;
        }
    }

    drawDamagedDigitalDisplay(ctx, w, h) {
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        // 1. Обугленная темная рамочка
        ctx.fillStyle = 'rgba(10, 12, 16, 0.96)';
        ctx.beginPath();
        this.drawRoundRect(ctx, 8, 8, w - 16, h - 16, 14);
        ctx.fill();

        // 2. Копоть от взрыва
        const scorch = ctx.createRadialGradient(cx, cy, 6, cx, cy, 85);
        scorch.addColorStop(0, 'rgba(15, 15, 18, 0.95)');
        scorch.addColorStop(0.35, 'rgba(45, 22, 18, 0.8)');
        scorch.addColorStop(0.75, 'rgba(65, 35, 25, 0.4)');
        scorch.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = scorch;
        ctx.beginPath();
        this.drawRoundRect(ctx, 8, 8, w - 16, h - 16, 14);
        ctx.fill();

        ctx.strokeStyle = Math.random() > 0.4 ? '#ef4444' : '#f97316';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 3. Мерцающий поврежденный индикатор
        const errorCodes = ['Er', 'E1', '--', '8-', 'Er'];
        const errText = errorCodes[Math.floor(Math.random() * errorCodes.length)];
        const isFlickerOn = this.isInitialExplosionFrame ? true : (Math.random() > 0.12);

        if (isFlickerOn) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 50px -apple-system, BlinkMacSystemFont, "Segoe UI", monospace';
            const isRed = Math.random() > 0.35;
            ctx.shadowColor = isRed ? '#ef4444' : '#00e5ff';
            ctx.shadowBlur = 18;
            ctx.fillStyle = isRed ? '#f87171' : '#38bdf8';
            ctx.fillText(errText, cx, cy);
            ctx.restore();
        }

        // 4. Звездчатая паутина трещин на защитном стекле
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const angles = [0.2, 0.85, 1.55, 2.3, 3.1, 3.8, 4.55, 5.3, 6.0];
        angles.forEach(baseAngle => {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            let curX = cx;
            let curY = cy;
            const segments = 3 + Math.floor(Math.random() * 2);
            const segDist = 10 + Math.random() * 8;

            for (let s = 0; s < segments; s++) {
                const devAngle = baseAngle + (Math.sin(s * 1.7) * 0.35);
                curX += Math.cos(devAngle) * segDist;
                curY += Math.sin(devAngle) * segDist;
                ctx.lineTo(curX, curY);

                if (s === 1 && Math.random() > 0.35) {
                    const branchAng = devAngle + (Math.random() > 0.5 ? 0.65 : -0.65);
                    ctx.lineTo(curX + Math.cos(branchAng) * 9, curY + Math.sin(branchAng) * 9);
                    ctx.moveTo(curX, curY);
                }
            }
            ctx.stroke();
        });

        [16, 32, 52].forEach(r => {
            ctx.beginPath();
            ctx.arc(cx, cy, r, Math.random() * Math.PI, Math.random() * Math.PI + Math.PI * 0.85);
            ctx.stroke();
        });

        ctx.restore();

        if (this.displayTexture) {
            this.displayTexture.needsUpdate = true;
        }
    }

    updateDisplayText(text, colorHex) {
        if (!this.displayCtx) return;
        const ctx = this.displayCtx;
        ctx.clearRect(0, 0, 256, 128);

        // Фоновая рамка дисплея
        ctx.fillStyle = 'rgba(10, 15, 28, 0.9)';
        ctx.beginPath();
        this.drawRoundRect(ctx, 10, 10, 236, 108, 16);
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
        this.outdoorBracket1 = b1;
        this.outdoorBracket2 = b2;

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

        // Реалистичный сплошной корпус Ballu DC Inverter со спиральной решеткой
        this.buildOutdoorSolidCasing(outdoorGroup, width, height, depth);

        this.outdoorGroup = outdoorGroup;
        this.scene.add(outdoorGroup);
    }

    // ----------------------------------------------------
    // РЕАЛИСТИЧНЫЙ КОРПУС ВНЕШНЕГО БЛОКА (LG, SAMSUNG, KENTATSU, BALLU)
    // ----------------------------------------------------
    generateOutdoorBalluFrontTexture(width, height) {
        return this.generateOutdoorFrontTexture('ballu', width, height);
    }

    generateOutdoorFrontTexture(modelId = 'lg', width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 716;
        const ctx = canvas.getContext('2d');
        const curModel = AC_MODELS[modelId] || AC_MODELS['lg'];
        const isClockwise = curModel.fanDirection === -1;

        // Фоновая эмаль белого металлического корпуса
        ctx.fillStyle = '#f4f6f8';
        ctx.fillRect(0, 0, 1024, 716);

        // Декоративная штамповка по внешнему периметру
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, 1004, 696);

        // ----------------------------------------------------
        // ЛЕВАЯ ЧАСТЬ: КРУГЛОЕ ВЫХОДНОЕ ОКНО СО СПИРАЛЬНОЙ РЕШЕТКОЙ
        // ----------------------------------------------------
        if (modelId === 'mitsubishi') {
            // ФИРМЕННАЯ ПРЯМОУГОЛЬНАЯ РЕШЕТКА MITSUBISHI ELECTRIC С ВЕРТИКАЛЬНЫМИ ЛАМЕЛЯМИ
            const gx = 85;
            const gy = 80;
            const gw = 580;
            const gh = 556;
            const gr = 18;

            ctx.save();
            ctx.beginPath();
            this.drawRoundRect(ctx, gx, gy, gw, gh, gr);
            ctx.clip();

            // Очищаем прямоугольник в прозрачность, чтобы видеть вращающийся 3D-пропеллер!
            ctx.clearRect(gx, gy, gw, gh);

            // Тонкие вертикальные защитные ламели
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 5;
            for (let x = gx + 16; x < gx + gw - 10; x += 16) {
                ctx.beginPath();
                ctx.moveTo(x, gy + 4);
                ctx.lineTo(x, gy + gh - 4);
                ctx.stroke();
            }

            // 3 горизонтальные силовые поперечины
            [gy + gh * 0.25, gy + gh * 0.50, gy + gh * 0.75].forEach(y => {
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.moveTo(gx, y);
                ctx.lineTo(gx + gw, y);
                ctx.stroke();
            });

            ctx.restore();

            // Внешняя окантовка прямоугольной решетки
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 6;
            ctx.beginPath();
            this.drawRoundRect(ctx, gx, gy, gw, gh, gr);
            ctx.stroke();

            // Боковые вентиляционные прорези на левой стороне корпуса (как на фото)
            for (let ly = 130; ly < 580; ly += 24) {
                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath();
                this.drawRoundRect(ctx, 24, ly, 42, 10, 5);
                ctx.fill();
            }
        } else {
        const cx = 389; // сопоставлено с положением вентилятора (-0.18м)
        const cy = 358;
        const radius = 265;
        const hubRadius = 58;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        // Очищаем круг в прозрачность, чтобы видеть вращающийся 3D-пропеллер!
        ctx.clearRect(cx - radius, cy - radius, radius * 2, radius * 2);

        // Центральная круглая заглушка ступицы решетки
        ctx.fillStyle = '#f4f6f8';
        ctx.beginPath();
        ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Концентрические кольца жесткости решетки
        const rings = [115, 175, 230, radius - 6];
        rings.forEach((r, idx) => {
            ctx.strokeStyle = idx === rings.length - 1 ? '#f4f6f8' : '#e2e8f0';
            ctx.lineWidth = idx === rings.length - 1 ? 12 : 5;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        });

        // 36 Спиральных аэродинамических ребер
        // Для Samsung (вращение по часовой) изгиб по часовой стрелке, для LG/Kentatsu/Ballu — против
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 6;
        for (let i = 0; i < 36; i++) {
            const angle0 = (i / 36) * Math.PI * 2;
            ctx.beginPath();
            for (let step = 0; step <= 25; step++) {
                const t = step / 25;
                const r = hubRadius + t * (radius - 8 - hubRadius);
                const spiralSign = isClockwise ? -1 : 1;
                const a = angle0 + spiralSign * Math.pow(t, 1.25) * 1.32;
                const px = cx + Math.cos(a) * r;
                const py = cy + Math.sin(a) * r;
                if (step === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        ctx.restore();

        // Внешний декоративный обод раструба
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

                }
// ----------------------------------------------------
        // ПРАВАЯ ЧАСТЬ: ФИРМЕННЫЙ ДИЗАЙН И ЛОГОТИП БРЕНДА
        // ----------------------------------------------------
        if (modelId === 'lg') {
            // ДИЗАЙН ВНЕШНЕГО БЛОКА LG DUAL INVERTER
            // Штамповка сервисной панели справа
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(690, 60, 300, 596, 24);
            ctx.stroke();

            const lx = 840, ly = 230, lr = 65;

            // Фирменный красный круг эмблемы LG (#a50034)
            ctx.fillStyle = '#a50034';
            ctx.beginPath();
            ctx.arc(lx, ly, lr, 0, Math.PI * 2);
            ctx.fill();

            // Белое стилизованное лицо L-G внутри эмблемы
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lr * 0.12;
            ctx.lineCap = 'round';

            // Контур буквы G
            ctx.beginPath();
            ctx.arc(lx, ly, lr * 0.64, -Math.PI * 0.75, Math.PI * 0.65);
            ctx.stroke();

            // Внутренний носик L
            ctx.beginPath();
            ctx.moveTo(lx - lr * 0.10, ly - lr * 0.32);
            ctx.lineTo(lx - lr * 0.10, ly + lr * 0.16);
            ctx.lineTo(lx + lr * 0.18, ly + lr * 0.16);
            ctx.stroke();

            // Точка-глаз
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(lx - lr * 0.28, ly - lr * 0.16, lr * 0.08, 0, Math.PI * 2);
            ctx.fill();

            // Надпись LG под эмблемой
            ctx.fillStyle = '#1e293b';
            ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('LG', lx, ly + lr + 55);

            // Надпись DUAL Inverter
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.fillText('DUAL Inverter', lx, ly + lr + 105);

            // Рельефные горизонтальные полосы штамповки внизу
            [480, 540].forEach(sy => {
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                ctx.roundRect(740, sy, 200, 18, 9);
                ctx.fill();
            });

        } else if (modelId === 'samsung') {
            // ДИЗАЙН ВНЕШНЕГО БЛОКА SAMSUNG WINDFREE
            // Общая штамповка сервисной панели справа
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(690, 60, 300, 596, 24);
            ctx.stroke();

            // Логотип SAMSUNG сверху справа фирменным синим цветом (#034ea2)
            ctx.fillStyle = '#034ea2';
            ctx.font = '900 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SAMSUNG', 840, 125);

            // Выштампованная рельефная крышка вентилей в форме характерного кармана Samsung
            const vx = 720, vy = 175, vw = 240, vh = 390;
            ctx.save();
            ctx.fillStyle = '#eef2f6';
            ctx.beginPath();
            ctx.roundRect(vx, vy, vw, vh, 20);
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Внутренние горизонтальные рельефные ребра
            [260, 320, 380, 440].forEach(ry => {
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                ctx.roundRect(vx + 25, ry, vw - 50, 16, 8);
                ctx.fill();
            });
            ctx.restore();

            // Надпись DIGITAL INVERTER внизу
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('DIGITAL INVERTER', 840, 605);

        } else if (modelId === 'kentatsu') {
            // ДИЗАЙН ВНЕШНЕГО БЛОКА KENTATSU YUKI
            // Штамповка панели
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(690, 60, 300, 596, 24);
            ctx.stroke();

            // Крупная красная эмблема Kentatsu Yuki (снежинка/цветок из 8 квадратов)
            const kx = 840, ky = 195;
            this.drawKentatsuIcon(ctx, kx, ky, 44);

            // 3 горизонтальные вентиляционные штампованные прорези
            [315, 365, 415].forEach(sy => {
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                ctx.roundRect(730, sy, 220, 20, 10);
                ctx.fill();

                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath();
                ctx.roundRect(733, sy + 3, 214, 7, 3);
                ctx.fill();
            });

            // Маленькая эмблема и надпись KENTATSU внизу
            this.drawKentatsuIcon(ctx, 755, 545, 12);
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('KENTATSU', 775, 545);

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('YUKI INVERTER', 840, 590);

                } else if (modelId === 'midea') {
            // ДИЗАЙН ВНЕШНЕГО БЛОКА MIDEA BLANC
            // Штамповка сервисной панели справа
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            this.drawRoundRect(ctx, 690, 60, 300, 596, 24);
            ctx.stroke();

            // Фирменный голубой шильдик Midea справа вверху
            const bx = 720, by = 90, bw = 240, bh = 130;
            ctx.fillStyle = '#0091d5'; // Midea Blue
            ctx.beginPath();
            this.drawRoundRect(ctx, bx, by, bw, bh, 18);
            ctx.fill();

            // Белая надпись Midea внутри шильдика
            this.drawMideaLogo(ctx, bx + bw / 2, by + bh / 2, 54, '#ffffff');

            // 3 горизонтальные вентиляционные штампованные прорези под логотипом
            [270, 325, 380].forEach(sy => {
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                this.drawRoundRect(ctx, 730, sy, 220, 20, 10);
                ctx.fill();

                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath();
                this.drawRoundRect(ctx, 734, sy + 4, 212, 7, 3);
                ctx.fill();
            });

            // Надпись INVERTER QUATTRO внизу
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('INVERTER QUATTRO', 840, 520);

        } else if (modelId === 'mitsubishi') {
            // ДИЗАЙН ВНЕШНЕГО БЛОКА MITSUBISHI ELECTRIC
            // Штамповка сервисной панели справа
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            this.drawRoundRect(ctx, 690, 60, 300, 596, 24);
            ctx.stroke();

            // Красная эмблема Mitsubishi (3 ромба / трилистник)
            const mx = 840, my = 175;
            this.drawMitsubishiLogo(ctx, mx, my, 34);

            // Фирменная надпись MITSUBISHI ELECTRIC под логотипом
            ctx.fillStyle = '#1e293b';
            ctx.font = '900 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('MITSUBISHI', mx, my + 65);

            ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
            ctx.fillText('ELECTRIC', mx, my + 102);

            // Рельефные вентиляционные выштамповки
            [350, 410, 470].forEach(sy => {
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                this.drawRoundRect(ctx, 735, sy, 210, 18, 9);
                ctx.fill();

                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath();
                this.drawRoundRect(ctx, 738, sy + 3, 204, 6, 3);
                ctx.fill();
            });

            // Надпись INVERTER внизу
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('INVERTER', mx, 570);

        } else if (modelId === 'energolux') {
            // ДИЗАЙН ВНЕШНЕГО БЛОКА ENERGOLUX BASEL
            // Выпуклая крышка вентилей сервисной панели
            const vx = 705, vy = 85, vw = 270, vh = 540;
            ctx.fillStyle = '#eef2f6';
            ctx.beginPath();
            this.drawRoundRect(ctx, vx, vy, vw, vh, 20);
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Логотип Energolux с красным квадратом
            const elX = vx + 22, elY = vy + 60;
            this.drawEnergoluxLogo(ctx, elX, elY, 32);

            // Рельефные горизонтальные ребра жесткости
            [230, 290, 350, 410].forEach(ry => {
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                this.drawRoundRect(ctx, vx + 25, ry, vw - 50, 16, 8);
                ctx.fill();
            });

            // Надпись SMART INVERTER внизу панели
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('DC INVERTER', vx + vw / 2, vy + vh - 45);

        } else {
            // BALLU DC INVERTER
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(690, 60, 300, 596, 24);
            ctx.stroke();

            // 1. Фирменный зеленый шильдик Ballu
            const bx = 720, by = 90, bw = 240, bh = 140;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 18);
            ctx.clip();

            // Изумрудный фон
            ctx.fillStyle = '#009a44';
            ctx.fillRect(bx, by, bw, bh);

            // Салатовая диагональная полоса внизу
            ctx.fillStyle = '#8dc63f';
            ctx.beginPath();
            ctx.moveTo(bx, by + bh);
            ctx.lineTo(bx + bw, by + bh - 28);
            ctx.lineTo(bx + bw, by + bh);
            ctx.closePath();
            ctx.fill();

            // Белая надпись Ballu
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Arial Black", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Ballu', bx + bw / 2, by + bh / 2 - 10);

            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('®', bx + bw / 2 + 90, by + bh / 2 - 26);
            ctx.restore();

            // 2. Три горизонтальные рельефные полосы штамповки
            const slots = [290, 350, 410];
            slots.forEach(sy => {
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                ctx.roundRect(730, sy, 220, 22, 11);
                ctx.fill();

                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath();
                ctx.roundRect(733, sy + 3, 214, 8, 4);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.roundRect(733, sy + 11, 214, 8, 4);
                ctx.fill();
            });

            // 3. Надпись DC INVERTER
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('DC INVERTER', 840, 525);
        }

        return new THREE.CanvasTexture(canvas);
    }

    buildOutdoorSolidCasing(outdoorGroup, width, height, depth) {
        this.outdoorCasingDims = { width, height, depth };
        this.outdoorSolidCasing = new THREE.Group();

        const frontTex = this.generateOutdoorFrontTexture(this.currentModelId, width, height);

        const metalWhiteMat = new THREE.MeshStandardMaterial({
            color: 0xf3f5f8,
            roughness: 0.38,
            metalness: 0.15
        });

        // 1. Корпус-кожух (зад, бока, дно)
        // Задняя панель
        const backGeo = new THREE.BoxGeometry(width * 0.99, height * 0.98, 0.02);
        const backMesh = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 }));
        backMesh.position.set(0, 0, -depth / 2 + 0.01);
        this.outdoorSolidCasing.add(backMesh);

        // Левая стенка (забор воздуха конденсатора)
        const leftGeo = new THREE.BoxGeometry(0.02, height * 0.98, depth * 0.98);
        const leftMesh = new THREE.Mesh(leftGeo, metalWhiteMat);
        leftMesh.position.set(-width / 2 + 0.01, 0, 0);
        this.outdoorSolidCasing.add(leftMesh);

        // Правая стенка
        const rightGeo = new THREE.BoxGeometry(0.02, height * 0.98, depth * 0.98);
        const rightMesh = new THREE.Mesh(rightGeo, metalWhiteMat);
        rightMesh.position.set(width / 2 - 0.01, 0, 0);
        this.outdoorSolidCasing.add(rightMesh);

        // Дно
        const botGeo = new THREE.BoxGeometry(width * 0.99, 0.02, depth * 0.98);
        const botMesh = new THREE.Mesh(botGeo, metalWhiteMat);
        botMesh.position.set(0, -height / 2 + 0.01, 0);
        this.outdoorSolidCasing.add(botMesh);

        // 2. Верхняя крышка с козырьком от дождя
        const topGeo = new THREE.BoxGeometry(width + 0.04, 0.04, depth + 0.04);
        const topMesh = new THREE.Mesh(topGeo, metalWhiteMat);
        topMesh.position.set(0, height / 2 + 0.02, 0);
        this.outdoorSolidCasing.add(topMesh);

        // 3. Лицевая панель со спиральной решеткой и прозрачными прорезями
        const frontGeo = new THREE.PlaneGeometry(width, height);
        const frontMat = new THREE.MeshStandardMaterial({
            map: frontTex,
            transparent: true,
            alphaTest: 0.2,
            roughness: 0.35,
            metalness: 0.12,
            side: THREE.DoubleSide
        });
        const frontMesh = new THREE.Mesh(frontGeo, frontMat);
        frontMesh.position.set(0, 0, depth / 2 + 0.005);
        this.outdoorSolidCasing.add(frontMesh);
        this.outdoorFrontMesh = frontMesh;

        // 4. Боковой сервисный кожух вентилей (справа)
        const shroudGroup = new THREE.Group();
        shroudGroup.position.set(width / 2 + 0.07, -height * 0.18, depth * 0.14);

        const shroudGeo = new THREE.BoxGeometry(0.14, 0.36, 0.26);
        const shroudMat = new THREE.MeshStandardMaterial({
            color: 0xf1f5f9,
            roughness: 0.32,
            metalness: 0.1
        });
        const shroudMesh = new THREE.Mesh(shroudGeo, shroudMat);
        shroudGroup.add(shroudMesh);

        // Скошенная нижняя кромка кожуха
        const wedgeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.26, 16);
        wedgeGeo.rotateX(Math.PI / 2);
        const wedgeMesh = new THREE.Mesh(wedgeGeo, shroudMat);
        wedgeMesh.position.set(0, -0.18, 0);
        shroudGroup.add(wedgeMesh);

        this.outdoorSolidCasing.add(shroudGroup);

        // 5. Нижние монтажные ножки (лапы)
        const footGeo = new THREE.BoxGeometry(0.12, 0.05, depth + 0.08);
        const footMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
        const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

        [-0.42, 0.42].forEach(x => {
            const foot = new THREE.Mesh(footGeo, footMat);
            foot.position.set(x, -height / 2 - 0.025, 0);
            const pad = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.015, 0.14), padMat);
            pad.position.set(0, -0.03, 0);
            foot.add(pad);
            this.outdoorSolidCasing.add(foot);
        });

        // По умолчанию видимость выключена (так как активен режим Рентген)
        this.outdoorSolidCasing.visible = !this.state.xray;
        outdoorGroup.add(this.outdoorSolidCasing);
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
        this.outdoorFanWireGrill = grillGroup;
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
        this.outdoorFanStaticGroup = staticGroup;

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
        this.outdoorBladeMat = new THREE.MeshStandardMaterial({
            color: 0x3b4759,
            metalness: 0.55,
            roughness: 0.28,
            side: THREE.DoubleSide
        });

        this.outdoorBladesGroup = new THREE.Group();
        rotorGroup.add(this.outdoorBladesGroup);

        const curModel = this.currentModel || AC_MODELS['lg'];
        this.updateOutdoorFanBlades(curModel.fanDirection === -1);

        outdoorGroup.add(rotorGroup);
        this.animatedObjects.outdoorFanRotor = rotorGroup;
        this.animatedObjects.outdoorFan = rotorGroup;
    }

    updateOutdoorFanBlades(isClockwise = false) {
        if (!this.outdoorBladesGroup || !this.outdoorBladeMat) return;
        while (this.outdoorBladesGroup.children.length > 0) {
            const child = this.outdoorBladesGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            this.outdoorBladesGroup.remove(child);
        }
        for (let b = 0; b < 3; b++) {
            const bladeAngle = (b / 3) * Math.PI * 2;
            const bladeMesh = this.createSickleBladeMesh(this.outdoorBladeMat, isClockwise);
            bladeMesh.rotation.z = bladeAngle;
            this.outdoorBladesGroup.add(bladeMesh);
        }
    }

    createSickleBladeMesh(material, isClockwise = false) {
        // Создаем реалистичную серповидную лопасть с профилем и закруткой (washout twist)
        const rRoot = 0.08;
        const rTip = 0.36;
        const radialSteps = 9;
        const chordSteps = 7;

        const vertices = [];
        const indices = [];
        const uvs = [];

        const dir = isClockwise ? -1 : 1;

        for (let i = 0; i <= radialSteps; i++) {
            const u = i / radialSteps;
            const r = rRoot + u * (rTip - rRoot);

            // Аэродинамическая закрутка угла атаки: от 34° у корня до 16° на конце
            const pitch = (0.60 - u * 0.32) * dir;

            // Серповидный изгиб лопасти назад (backward sickle sweep)
            const sweep = (Math.pow(u, 1.4) * 0.45) * dir;

            // Хорда лопасти: утолщается в средней части
            const chord = 0.095 + Math.sin(u * Math.PI) * 0.075;

            for (let j = 0; j <= chordSteps; j++) {
                const v = j / chordSteps;

                // Профиль толщины и прогиба
                const camber = Math.sin(v * Math.PI) * (0.016 - u * 0.007) * dir;

                const cDist = (v - 0.32) * chord * dir;
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

    setModel(modelId) {
        if (!AC_MODELS[modelId]) return;
        this.currentModelId = modelId;
        this.currentModel = AC_MODELS[modelId];

        // 1. Обновляем цвета и материалы внутреннего блока
        if (this.indoorPlasticMat) {
            this.indoorPlasticMat.color.setHex(this.currentModel.indoorPlasticColor);
            this.indoorPlasticMat.roughness = this.currentModel.indoorPlasticRoughness ?? 0.18;
            this.indoorPlasticMat.metalness = this.currentModel.indoorPlasticMetalness ?? 0.05;
        }
        if (this.indoorLouverMat) {
            this.indoorLouverMat.color.setHex(this.currentModel.indoorLouverColor);
        }
        if (this.indoorSlotMat) {
            this.indoorSlotMat.color.setHex(this.currentModel.indoorSlotColor ?? 0x94a3b8);
        }

        // 2. Обновляем текстуру передней панели внутреннего блока с логотипом
        this.updateIndoorFasciaDisplay();

        // 3. Обновляем текстуру лицевой панели внешнего блока с брендом и решеткой
        if (this.outdoorFrontMesh && this.outdoorCasingDims) {
            const newTex = this.generateOutdoorFrontTexture(
                modelId,
                this.outdoorCasingDims.width,
                this.outdoorCasingDims.height
            );
            if (this.outdoorFrontMesh.material.map) {
                this.outdoorFrontMesh.material.map.dispose();
            }
            this.outdoorFrontMesh.material.map = newTex;
            this.outdoorFrontMesh.material.needsUpdate = true;
        }

        // 4. Обновляем лопасти вентилятора под направление вращения
        this.updateOutdoorFanBlades(this.currentModel.fanDirection === -1);

        const isCassette = (modelId === 'lg_cassette');

        // Переключение видимости блоков между стандартным сплитом и 4-Way кассетой
        if (this.indoorGroup) this.indoorGroup.visible = !isCassette;
        if (this.indoorCassetteGroup) this.indoorCassetteGroup.visible = isCassette;

        if (this.outdoorGroup) this.outdoorGroup.visible = !isCassette;
        if (this.outdoorDualGroup) this.outdoorDualGroup.visible = isCassette;

        if (this.pipeGroup) this.pipeGroup.visible = !isCassette;
        if (this.cassettePipeGroup) this.cassettePipeGroup.visible = isCassette;

        // Потоки воздуха
        if (this.indoorAirMesh) this.indoorAirMesh.visible = !isCassette && this.state.power;
        if (this.outdoorAirMesh) this.outdoorAirMesh.visible = !isCassette && this.state.power;

        if (this.cassetteIndoorAirMesh) this.cassetteIndoorAirMesh.visible = isCassette && this.state.power;
        if (this.cassetteOutdoorAirMesh) this.cassetteOutdoorAirMesh.visible = isCassette && this.state.power;
    }

    buildPiping() {
        // Медные трубки межблочной трассы, разделенные на 6 сегментов (комната, стена, улица)
        const pipeGroup = new THREE.Group();
        this.pipingMeshes = [];

        const gasMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            metalness: 0.85,
            roughness: 0.3
        });
        const liquidMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            metalness: 0.9,
            roughness: 0.2
        });

        // 1. Толстая газовая трубка: комнатный отрезок
        const gasCurveIndoor = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.0, 2.25, 0.0),
            new THREE.Vector3(-0.5, 2.10, 0.015),
            new THREE.Vector3(-0.16, 1.98, 0.025)
        ]);
        const gasIndoor = new THREE.Mesh(new THREE.TubeGeometry(gasCurveIndoor, 18, 0.022, 12, false), gasMat);
        pipeGroup.add(gasIndoor);
        this.pipingMeshes.push(gasIndoor);

        // Толстая газовая трубка: отрезок внутри гильзы стены
        const gasCurveWall = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.16, 1.98, 0.025),
            new THREE.Vector3(0.0, 1.92, 0.03),
            new THREE.Vector3(0.18, 1.84, 0.025)
        ]);
        const gasWall = new THREE.Mesh(new THREE.TubeGeometry(gasCurveWall, 14, 0.022, 12, false), gasMat);
        pipeGroup.add(gasWall);
        this.pipingMeshes.push(gasWall);

        // Толстая газовая трубка: уличный отрезок
        const gasCurveOutdoor = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.18, 1.84, 0.025),
            new THREE.Vector3(0.6, 1.65, 0.01),
            new THREE.Vector3(1.2, 1.35, -0.05),
            new THREE.Vector3(1.7, 1.25, -0.05)
        ]);
        const gasOutdoor = new THREE.Mesh(new THREE.TubeGeometry(gasCurveOutdoor, 28, 0.022, 12, false), gasMat);
        pipeGroup.add(gasOutdoor);
        this.pipingMeshes.push(gasOutdoor);

        // 2. Тонкая жидкостная трубка: комнатный отрезок
        const liquidCurveIndoor = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.0, 2.2, -0.03),
            new THREE.Vector3(-0.5, 2.05, -0.025),
            new THREE.Vector3(-0.16, 1.93, -0.02)
        ]);
        const liquidIndoor = new THREE.Mesh(new THREE.TubeGeometry(liquidCurveIndoor, 18, 0.013, 12, false), liquidMat);
        pipeGroup.add(liquidIndoor);
        this.pipingMeshes.push(liquidIndoor);

        // Тонкая жидкостная трубка: отрезок внутри гильзы стены
        const liquidCurveWall = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.16, 1.93, -0.02),
            new THREE.Vector3(0.0, 1.88, -0.02),
            new THREE.Vector3(0.18, 1.80, -0.015)
        ]);
        const liquidWall = new THREE.Mesh(new THREE.TubeGeometry(liquidCurveWall, 14, 0.013, 12, false), liquidMat);
        pipeGroup.add(liquidWall);
        this.pipingMeshes.push(liquidWall);

        // Тонкая жидкостная трубка: уличный отрезок
        const liquidCurveOutdoor = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.18, 1.80, -0.015),
            new THREE.Vector3(0.6, 1.55, 0.0),
            new THREE.Vector3(1.2, 1.1, 0.08),
            new THREE.Vector3(1.7, 0.85, 0.15)
        ]);
        const liquidOutdoor = new THREE.Mesh(new THREE.TubeGeometry(liquidCurveOutdoor, 28, 0.013, 12, false), liquidMat);
        pipeGroup.add(liquidOutdoor);
        this.pipingMeshes.push(liquidOutdoor);

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

        // Сохраняем исходные материалы для эффекта белого мерцания крипера
        this.creeperHeadMaterials = headMaterials;
        this.creeperGreenMat = greenMat;
        this.creeperWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.creeperWhiteHeadMaterials = [
            this.creeperWhiteMat, this.creeperWhiteMat, this.creeperWhiteMat,
            this.creeperWhiteMat, this.creeperWhiteMat, this.creeperWhiteMat
        ];

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
            bubbleTimer: 0,
            clickCount: 0,
            lastClickTime: 0,
            isPrimed: false,
            fuseTimer: 0,
            isExploded: false
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

    setCreeperWhite(isWhite) {
        if (!this.creeperHead || !this.creeperBody) return;
        if (isWhite) {
            this.creeperHead.material = this.creeperWhiteHeadMaterials;
            this.creeperBody.material = this.creeperWhiteMat;
            this.creeperLegs.forEach(leg => leg.material = this.creeperWhiteMat);
        } else {
            this.creeperHead.material = this.creeperHeadMaterials;
            this.creeperBody.material = this.creeperGreenMat;
            this.creeperLegs.forEach(leg => leg.material = this.creeperGreenMat);
        }
    }

    restoreCreeperMaterials() {
        this.setCreeperWhite(false);
    }

    primeCreeper() {
        this.creeperState.isPrimed = true;
        this.creeperState.fuseTimer = 1.5;
        this.creeperState.bubbleTimer = 2.0;
        this.renderSpeechBubble("💥 Ш-Ш-Ш... СЕЙЧАС БУМКНЕТ! (3/3)");
        if (window.soundEngine) {
            window.soundEngine.playCreeperFuse();
        }
    }

    explodeCreeper() {
        this.creeperState.isPrimed = false;
        this.creeperState.isExploded = true;
        this.creeperGroup.visible = false;
        this.restoreCreeperMaterials();

        if (window.soundEngine) {
            window.soundEngine.playCreeperExplosion();
        }

        // 1. Тряска камеры
        this.cameraShakeIntensity = 0.52;
        this.cameraShakeTimer = 0.85;

        // 2. Вспышка экрана
        const flashEl = document.getElementById('explosion-flash');
        if (flashEl) {
            flashEl.classList.add('active');
            setTimeout(() => flashEl.classList.remove('active'), 250);
        }

        // 3. Воксельные частицы взрыва Minecraft
        const blastCenter = this.creeperBasePos.clone().add(new THREE.Vector3(0, 0.45, 0));
        this.spawnMinecraftExplosionParticles(blastCenter);

        // 4. Физический разлет блоков кондиционера
        this.disintegrateAC();
    }

    spawnMinecraftExplosionParticles(origin) {
        if (!this.explosionParticlesGroup) {
            this.explosionParticlesGroup = new THREE.Group();
            this.scene.add(this.explosionParticlesGroup);
        }
        this.explosionParticles = [];

        const colors = [0xffffff, 0xf1f5f9, 0x94a3b8, 0x475569, 0xf97316, 0xef4444, 0x1e293b];
        const particleCount = 52;

        for (let i = 0; i < particleCount; i++) {
            const size = 0.08 + Math.random() * 0.16;
            const geo = new THREE.BoxGeometry(size, size, size);
            const col = colors[Math.floor(Math.random() * colors.length)];
            const mat = new THREE.MeshBasicMaterial({
                color: col,
                transparent: true,
                opacity: 0.95
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(origin).add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.35,
                (Math.random() - 0.5) * 0.35,
                (Math.random() - 0.5) * 0.35
            ));
            this.explosionParticlesGroup.add(mesh);

            // Случайный разлет во все стороны (сфера)
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const speed = 2.5 + Math.random() * 6.0;
            const vel = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.abs(Math.cos(phi)) * speed * 0.85 + 1.2,
                Math.sin(phi) * Math.sin(theta) * speed
            );

            this.explosionParticles.push({
                mesh,
                vel,
                rotVel: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
                life: 0,
                maxLife: 0.85 + Math.random() * 0.65,
                initScale: 1.0
            });
        }
    }

        spawnWallDebrisDust() {
        if (!this.explosionParticlesGroup) {
            this.explosionParticlesGroup = new THREE.Group();
            this.scene.add(this.explosionParticlesGroup);
        }

        // Облако серой бетонной пыли от разрушенной стены
        for (let i = 0; i < 36; i++) {
            const size = 0.08 + Math.random() * 0.18;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x64748b : 0x94a3b8,
                transparent: true,
                opacity: 0.85
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                (Math.random() - 0.5) * 0.45,
                0.5 + Math.random() * 3.2,
                (Math.random() - 0.5) * 4.2
            );
            this.explosionParticlesGroup.add(mesh);

            const vel = new THREE.Vector3(
                Math.random() * 3.8 + 1.2,
                (Math.random() - 0.5) * 2.8,
                (Math.random() - 0.5) * 3.8
            );

            this.explosionParticles.push({
                mesh,
                vel,
                rotVel: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8),
                life: 0,
                maxLife: 1.8 + Math.random() * 1.0,
                initScale: 1.0
            });
        }
    }

    spawnFreonLeakSmoke() {
        if (!this.explosionParticlesGroup) {
            this.explosionParticlesGroup = new THREE.Group();
            this.scene.add(this.explosionParticlesGroup);
        }

        // Облако белого пара в месте соединения трубок
        const pipeCenter = new THREE.Vector3(0, 1.9, 0.03);
        for (let i = 0; i < 24; i++) {
            const size = 0.07 + Math.random() * 0.12;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xe0f2fe,
                transparent: true,
                opacity: 0.85
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pipeCenter).add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            ));
            this.explosionParticlesGroup.add(mesh);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 2.2,
                Math.random() * 2.0 + 0.5,
                (Math.random() - 0.5) * 2.2
            );

            this.explosionParticles.push({
                mesh,
                vel,
                rotVel: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
                life: 0,
                maxLife: 1.6 + Math.random() * 0.8,
                initScale: 1.0
            });
        }
    }

    disintegrateAC() {
        this.isACDestroyed = true;
        this.debrisList = [];

        const blastOrigin = this.creeperBasePos.clone().add(new THREE.Vector3(0, 0.45, 0));
        const itemsToDisintegrate = [];

        // 1. СТЕНА: 16 объемных бетонных блоков + 4 неоновых кромки + металлическая гильза
        if (this.wallBlocks) {
            this.wallBlocks.forEach(b => itemsToDisintegrate.push(b));
        }
        if (this.wallTrimBlocks) {
            this.wallTrimBlocks.forEach(t => itemsToDisintegrate.push(t));
        }
        if (this.wallSleeveMesh) {
            itemsToDisintegrate.push(this.wallSleeveMesh);
        }

        // 2. МЕЖБЛОЧНАЯ ТРАССА: разорванные медные трубки
        if (this.pipingMeshes) {
            this.pipingMeshes.forEach(p => itemsToDisintegrate.push(p));
        }

        // 3. ВНУТРЕННИЙ БЛОК: абсолютно ВСЕ внешние и внутренние узлы!
        if (this.indoorSolidCasing) {
            [...this.indoorSolidCasing.children].forEach(child => itemsToDisintegrate.push(child));
        }
        if (this.indoorCaseMesh) itemsToDisintegrate.push(this.indoorCaseMesh);
        if (this.displayMesh) itemsToDisintegrate.push(this.displayMesh);
        if (this.evaporatorGroup) itemsToDisintegrate.push(this.evaporatorGroup);
        if (this.animatedObjects.indoorFan) itemsToDisintegrate.push(this.animatedObjects.indoorFan);
        if (this.indoorFanMotor) itemsToDisintegrate.push(this.indoorFanMotor);
        if (this.indoorBearing) itemsToDisintegrate.push(this.indoorBearing);
        if (this.indoorBackPlate) itemsToDisintegrate.push(this.indoorBackPlate);
        if (this.indoorTopGrill) itemsToDisintegrate.push(this.indoorTopGrill);
        if (this.animatedObjects.indoorLouvers) itemsToDisintegrate.push(this.animatedObjects.indoorLouvers);

        // 4. ВНЕШНИЙ БЛОК: абсолютно ВСЕ внешние и внутренние узлы!
        if (this.outdoorSolidCasing) {
            [...this.outdoorSolidCasing.children].forEach(child => itemsToDisintegrate.push(child));
        }
        if (this.outdoorCaseMesh) itemsToDisintegrate.push(this.outdoorCaseMesh);
        if (this.animatedObjects.compressor) itemsToDisintegrate.push(this.animatedObjects.compressor);
        if (this.condenserGroup) itemsToDisintegrate.push(this.condenserGroup);
        if (this.animatedObjects.outdoorFanRotor) itemsToDisintegrate.push(this.animatedObjects.outdoorFanRotor);
        if (this.outdoorFanWireGrill) itemsToDisintegrate.push(this.outdoorFanWireGrill);
        if (this.outdoorFanStaticGroup) itemsToDisintegrate.push(this.outdoorFanStaticGroup);
        if (this.expansionValveGroup) itemsToDisintegrate.push(this.expansionValveGroup);
        if (this.reversingValveGroup) itemsToDisintegrate.push(this.reversingValveGroup);
        if (this.outdoorBracket1) itemsToDisintegrate.push(this.outdoorBracket1);
        if (this.outdoorBracket2) itemsToDisintegrate.push(this.outdoorBracket2);

        // Разрушение кассетного внутреннего блока и двухвентиляторного внешнего блока
        if (this.currentModelId === 'lg_cassette') {
            if (this.cassetteChassisMesh) itemsToDisintegrate.push(this.cassetteChassisMesh);
            if (this.cassettePanelMesh) itemsToDisintegrate.push(this.cassettePanelMesh);
            if (this.cassetteIntakeGrill) itemsToDisintegrate.push(this.cassetteIntakeGrill);
            if (this.cassetteLouvers) {
                this.cassetteLouvers.forEach(l => itemsToDisintegrate.push(l));
            }
            if (this.cassetteTurboFan) itemsToDisintegrate.push(this.cassetteTurboFan);
            if (this.cassetteMotorMesh) itemsToDisintegrate.push(this.cassetteMotorMesh);
            if (this.cassetteEvaporatorGroup) itemsToDisintegrate.push(this.cassetteEvaporatorGroup);
            if (this.cassetteDrainTray) itemsToDisintegrate.push(this.cassetteDrainTray);
            if (this.cassetteDrainPump) itemsToDisintegrate.push(this.cassetteDrainPump);

            if (this.dualBracket1) itemsToDisintegrate.push(this.dualBracket1);
            if (this.dualBracket2) itemsToDisintegrate.push(this.dualBracket2);
            if (this.dualBackMesh) itemsToDisintegrate.push(this.dualBackMesh);
            if (this.dualLeftMesh) itemsToDisintegrate.push(this.dualLeftMesh);
            if (this.dualRightMesh) itemsToDisintegrate.push(this.dualRightMesh);
            if (this.dualTopMesh) itemsToDisintegrate.push(this.dualTopMesh);
            if (this.dualBotMesh) itemsToDisintegrate.push(this.dualBotMesh);
            if (this.dualFrontMesh) itemsToDisintegrate.push(this.dualFrontMesh);
            if (this.dualFanRotors) {
                this.dualFanRotors.forEach(r => itemsToDisintegrate.push(r));
            }
            if (this.dualFanStators) {
                this.dualFanStators.forEach(s => itemsToDisintegrate.push(s));
            }
            if (this.dualCondenserGroup) itemsToDisintegrate.push(this.dualCondenserGroup);
            if (this.dualCompressorGroup) itemsToDisintegrate.push(this.dualCompressorGroup);
            if (this.dualExpansionValveGroup) itemsToDisintegrate.push(this.dualExpansionValveGroup);
            if (this.dualReversingValveGroup) itemsToDisintegrate.push(this.dualReversingValveGroup);

            if (this.cassettePipingMeshes) {
                this.cassettePipingMeshes.forEach(p => itemsToDisintegrate.push(p));
            }
        }

        // Все разлетающиеся детали делаем видимыми
        itemsToDisintegrate.forEach(obj => {
            if (obj) obj.visible = true;
        });

        itemsToDisintegrate.forEach(obj => {
            if (!obj || !obj.parent) return;

            // Запоминаем локальные координаты до переноса
            obj.userData.origParent = obj.parent;
            obj.userData.origPosition = obj.position.clone();
            obj.userData.origRotation = obj.rotation.clone();
            obj.userData.origScale = obj.scale.clone();

            // Переносим объект в мировую сцену с сохранением мирового положения
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);
            this.scene.attach(obj);

            // Направление взрывной волны от крипера
            const blastDir = new THREE.Vector3().subVectors(worldPos, blastOrigin);
            const dist = blastDir.length();
            blastDir.normalize();

            // Сила взрыва зависит от расстояния до эпицентра
            const force = Math.max(2.8, 8.5 - dist * 0.7);

            const velocity = new THREE.Vector3(
                blastDir.x * force + (Math.random() - 0.5) * 1.6,
                Math.random() * 4.2 + 3.8, // подброс вверх
                blastDir.z * force + (Math.random() - 0.5) * 1.6
            );

            const angularVelocity = new THREE.Vector3(
                (Math.random() - 0.5) * 8.0,
                (Math.random() - 0.5) * 8.0,
                (Math.random() - 0.5) * 8.0
            );

            this.debrisList.push({
                obj,
                velocity,
                angularVelocity,
                settled: false
            });
        });

        // Полностью глушим звук кондиционера
        if (window.soundEngine) {
            window.soundEngine.silenceAC();
        }

        // Отключаем активные потоки воздуха и фреон, обнуляем скорости вентиляторов
        this.physics.airflowIntensity = 0;
        this.physics.refrigerantSpeed = 0;
        this.physics.fanRpmCurrent = 0;
        this.physics.fanRpmTarget = 0;
        this.physics.indoorFanRpmCurrent = 0;
        this.physics.indoorFanRpmTarget = 0;
        if (this.refParticlesMesh) this.refParticlesMesh.visible = false;
        if (this.indoorAirMesh) this.indoorAirMesh.visible = false;
        if (this.outdoorAirMesh) this.outdoorAirMesh.visible = false;

        // Повреждение и трещины индикатора внутреннего блока (для обоих типов дисплеев)
        this.isInitialExplosionFrame = true;
        this.updateIndoorFasciaDisplay();
        this.updateDigitalDisplay();
        this.isInitialExplosionFrame = false;

        // Сноп электрических искр из разбитого дисплея
        this.spawnElectricSparkBurst();

        // Выпускаем облако фреона
        this.spawnFreonLeakSmoke();
        this.spawnWallDebrisDust();

        // Уведомляем интерфейс о взрыве
        if (window.onCreeperExplosion) {
            window.onCreeperExplosion();
        }
    }

    spawnElectricSparkBurst() {
        const targets = [];
        if (this.state.xray && this.displayMesh) {
            targets.push({ mesh: this.displayMesh, isDisplayMesh: true });
        } else if (this.indoorFrontMesh) {
            targets.push({ mesh: this.indoorFrontMesh, isDisplayMesh: false });
        }
        if (targets.length === 0) {
            if (this.displayMesh) targets.push({ mesh: this.displayMesh, isDisplayMesh: true });
            if (this.indoorFrontMesh) targets.push({ mesh: this.indoorFrontMesh, isDisplayMesh: false });
        }

        targets.forEach(({ mesh, isDisplayMesh }) => {
            if (!mesh) return;
            mesh.updateMatrixWorld(true);

            let sparkOrigin;
            if (isDisplayMesh) {
                sparkOrigin = new THREE.Vector3(0, 0, 0.02).applyMatrix4(mesh.matrixWorld);
            } else {
                const localPos = (this.currentModelId === 'samsung')
                    ? new THREE.Vector3(0.61, -0.17, 0.02)
                    : (this.currentModelId === 'energolux')
                    ? new THREE.Vector3(0.0, 0.025, 0.02)
                    : new THREE.Vector3(0.57, 0.025, 0.02);
                sparkOrigin = localPos.clone().applyMatrix4(mesh.matrixWorld);
            }

            const count = 5 + Math.floor(Math.random() * 6);
            for (let i = 0; i < count; i++) {
                const size = 0.012 + Math.random() * 0.01;
                const sparkGeo = new THREE.BoxGeometry(size, size, size);
                const isYellow = Math.random() > 0.35;
                const sparkMat = new THREE.MeshBasicMaterial({
                    color: isYellow ? 0xffea00 : 0x00e5ff,
                    transparent: true,
                    opacity: 1.0
                });
                const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
                sparkMesh.position.copy(sparkOrigin).add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.06,
                    (Math.random() - 0.5) * 0.06,
                    (Math.random() - 0.5) * 0.06
                ));
                this.scene.add(sparkMesh);

                const vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 2.2,
                    Math.random() * 2.4 + 0.8,
                    Math.random() * 2.0 + 0.5
                );

                this.electricSparks.push({
                    mesh: sparkMesh,
                    vel: vel,
                    life: 0,
                    maxLife: 0.22 + Math.random() * 0.2
                });
            }
        });
    }

    restoreAirConditioner() {
        if (!this.isACDestroyed) return;
        this.isRestoring = true;
        this.restoreProgress = 0;

        // Фиксируем текущие мировые позиции обломков на полу для плавной интерполяции
        this.debrisList.forEach(item => {
            item.startPos = item.obj.position.clone();
            item.startRot = item.obj.rotation.clone();
        });
    }

    onCreeperClicked() {
        if (this.creeperState.isPrimed || this.creeperState.isExploded) return;

        const now = performance.now();
        if (now - this.creeperState.lastClickTime < 2500) {
            this.creeperState.clickCount++;
        } else {
            this.creeperState.clickCount = 1;
        }
        this.creeperState.lastClickTime = now;

        // Запуск последовательности детонации на 3-й быстрый клик
        if (this.creeperState.clickCount >= 3) {
            this.primeCreeper();
            return;
        }

        if (window.soundEngine) {
            window.soundEngine.playCreeperSound();
        }

        // Анимация прыжка и фраза
        this.creeperState.isJumping = true;
        this.creeperState.jumpProgress = 0;
        this.creeperState.bubbleTimer = 3.6;

        if (this.creeperState.clickCount === 2) {
            this.renderSpeechBubble("⚠️ Ой-ой! Не тыкай так часто, а то зашиплю! (2/3)");
            return;
        }

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
        let baseItem = this.hotspotData.find(h => h.id === id);
        if (!baseItem) return;

        let item = Object.assign({}, baseItem);

        // Динамическая адаптация описаний узлов и ракурса камеры для кассетного кондиционера
        if (this.currentModelId === 'lg_cassette') {
            if (id === 'indoorFan') {
                item.title = '🌀 Центробежный 3D Turbo вентилятор';
                item.subtitle = 'Засасывает воздух снизу и разбрасывает на 360°';
                item.desc = 'В отличие от настенных блоков с длинным барабаном, в кассете установлена мощная центробежная турбина! Она вращается вокруг вертикальной оси, затягивает комнатный воздух снизу через фильтр и центробежной силой разгоняет его во все 4 стороны сквозь круговой радиатор!';
                item.camPos = new THREE.Vector3(-1.6, 2.3, 1.1);
                item.target = new THREE.Vector3(-1.6, 3.2, 0.0);
            } else if (id === 'evaporator') {
                item.title = '❄️ Круговой 4-сторонний испаритель';
                item.subtitle = 'Окружает турбину со всех четырех сторон';
                item.desc = 'Этот радиатор образует сплошной замкнутый контур вокруг центробежного вентилятора. Воздух проходит сквозь сотни ледяных алюминиевых пластинок, мгновенно остывает и выходит в комнату сразу через 4 жалюзи — равномерно охлаждая всё помещение!';
                item.camPos = new THREE.Vector3(-1.6, 3.8, 1.4);
                item.target = new THREE.Vector3(-1.6, 3.2, 0.0);
            } else if (id === 'outdoorFan') {
                item.title = '🌪️ Два уличных пропеллера (LG Dual Fan)';
                item.subtitle = 'Удвоенная производительность сброса тепла';
                item.desc = 'Здесь работают сразу два мощных уличных вентилятора, расположенных друг над другом! Кассетный кондиционер охлаждает большие офисы и залы, поэтому ему нужен гигантский радиатор и сразу два пропеллера, чтобы выбрасывать на улицу в 2 раза больше тепла!';
                item.camPos = new THREE.Vector3(1.8, 1.35, 2.1);
                item.target = new THREE.Vector3(1.8, 1.35, 0.1);
            }
        }

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
        const isCass = (this.currentModelId === 'lg_cassette');
        if (this.cassetteIndoorAirMesh) this.cassetteIndoorAirMesh.visible = isCass && isOn;
        if (this.cassetteOutdoorAirMesh) this.cassetteOutdoorAirMesh.visible = isCass && isOn;
        if (this.displayMesh) {
            this.displayMesh.visible = this.state.xray && (isOn || this.isACDestroyed);
        }

        // Обновляем LED дисплей на корпусе и цифровой дисплей
        this.updateIndoorBalluDisplay();
        this.updateDigitalDisplay();
    }

    setMode(mode) {
        // 'cool' | 'heat' | 'fan'
        this.state.mode = mode;
        const color = mode === 'heat' ? '#ff7a00' : (mode === 'fan' ? '#10b981' : '#00e5ff');
        this.updateDisplayText(`${this.state.targetTemp}°C`, color);
        this.updateIndoorBalluDisplay();
        this.updateDigitalDisplay();

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

        // Обновляем LED дисплей на корпусе и цифровой дисплей
        this.updateIndoorBalluDisplay();
        this.updateDigitalDisplay();

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
        if (this.isACDestroyed) return this.state.xray;
        return this.setXRayMode();
    }

    setXRayMode() {
        this.state.xray = !this.state.xray;

        // Показ/скрытие реалистичных сплошных корпусов
        if (this.indoorSolidCasing) {
            this.indoorSolidCasing.visible = !this.state.xray;
        }
        if (this.outdoorSolidCasing) {
            this.outdoorSolidCasing.visible = !this.state.xray;
        }

        // Внутренний полупрозрачный каркас хай-тек (виден в режиме Рентген)
        if (this.indoorCaseMesh) {
            this.indoorCaseMesh.visible = this.state.xray;
        }
        if (this.outdoorCaseMesh) {
            this.outdoorCaseMesh.visible = this.state.xray;
        }

        // Защитная проволочная решетка вентилятора (скрываем в режиме корпуса, так как там спиральная решетка на панели)
        if (this.outdoorFanWireGrill) {
            this.outdoorFanWireGrill.visible = this.state.xray;
        }

        // Цифровой дисплей на каркасе (виден только в режиме Рентген при включенном питании или при аварии)
        if (this.displayMesh) {
            this.displayMesh.visible = this.state.xray && (this.state.power || this.isACDestroyed);
        }

        if (this.currentModelId === 'lg_cassette') {
            const cassOpacity = this.state.xray ? 0.28 : 1.0;
            const cassTransparent = this.state.xray;
            if (this.cassetteChassisMesh) {
                this.cassetteChassisMesh.material.transparent = cassTransparent;
                this.cassetteChassisMesh.material.opacity = cassOpacity;
            }
            if (this.cassettePanelMesh) {
                this.cassettePanelMesh.material.transparent = cassTransparent;
                this.cassettePanelMesh.material.opacity = cassOpacity;
            }
            [this.dualBackMesh, this.dualLeftMesh, this.dualRightMesh, this.dualTopMesh, this.dualBotMesh].forEach(m => {
                if (m) {
                    m.material.transparent = cassTransparent;
                    m.material.opacity = cassOpacity;
                }
            });
            if (this.dualFrontMesh) {
                this.dualFrontMesh.material.opacity = this.state.xray ? 0.35 : 1.0;
            }
        }

        this.updateDigitalDisplay();
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
        if (this.isACDestroyed) {
            // Кондиционер разрушен: полная остановка вентиляторов и потоков
            this.physics.fanRpmCurrent = 0;
            this.physics.fanRpmTarget = 0;
            this.physics.indoorFanRpmCurrent = 0;
            this.physics.indoorFanRpmTarget = 0;
            this.physics.airflowIntensity = 0;
            this.physics.refrigerantSpeed = 0;
            this.physics.louverAngle = 0;
        } else if (!this.state.power) {
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

        // Вращение вентиляторов (только когда кондиционер цел)
        const spinDelta = effectiveDelta;
        if (!this.isACDestroyed) {
            if (this.currentModelId === 'lg_cassette') {
                // Вращение обоих вентиляторов внешнего блока LG Dual Fan (против часовой стрелки)
                if (this.dualFanRotors && this.physics.fanRpmCurrent > 0.01) {
                    this.dualFanRotors.forEach(r => {
                        r.rotation.z += 1 * spinDelta * this.physics.fanRpmCurrent;
                    });
                }
                // Вращение центробежной 3D турбины кассеты вокруг вертикальной оси Y
                if (this.animatedObjects.cassetteTurboFan && this.physics.indoorFanRpmCurrent > 0.01) {
                    this.animatedObjects.cassetteTurboFan.rotation.y += spinDelta * this.physics.indoorFanRpmCurrent;
                }
                // 4-сторонние моторизованные шторки жалюзи кассеты
                if (this.cassetteLouvers) {
                    const targetAngle = this.state.power ? (0.42 + Math.sin(time * 1.5) * 0.06) : 0.0;
                    this.cassetteLouvers.forEach(l => {
                        if (l.children[0]) {
                            l.children[0].rotation.x += (targetAngle - l.children[0].rotation.x) * delta * 2.0;
                        }
                    });
                }
            } else {
                if (this.animatedObjects.indoorFan && this.physics.indoorFanRpmCurrent > 0.01) {
                    this.animatedObjects.indoorFan.rotation.x -= spinDelta * this.physics.indoorFanRpmCurrent;
                }
                if (this.animatedObjects.outdoorFanRotor && this.physics.fanRpmCurrent > 0.01) {
                    const fanDir = (this.currentModel && typeof this.currentModel.fanDirection === 'number') ? this.currentModel.fanDirection : 1;
                    this.animatedObjects.outdoorFanRotor.rotation.z += fanDir * spinDelta * this.physics.fanRpmCurrent;
                }
                if (this.animatedObjects.indoorLouvers) {
                    this.animatedObjects.indoorLouvers.rotation.x = this.physics.louverAngle;
                }
                if (this.animatedObjects.solidIndoorLouver) {
                    this.animatedObjects.solidIndoorLouver.rotation.x = this.physics.louverAngle;
                }
            }
        }

        // Вибрация компрессора (пропорциональна текущей скорости, только когда цел)
        if (this.animatedObjects.compressor && !this.isACDestroyed) {
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

        // 4. Анимация потоков воздуха (только при включенном кондиционере)
        const hasAirflow = this.state.power && !this.isACDestroyed && (this.physics.airflowIntensity > 0.008);

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

        // Анимация 4-стороннего выдува кассеты и двух уличных потоков
        if (this.currentModelId === 'lg_cassette') {
            if (this.indoorAirMesh) this.indoorAirMesh.visible = false;
            if (this.outdoorAirMesh) this.outdoorAirMesh.visible = false;

            if (this.cassetteIndoorAirMesh) {
                this.cassetteIndoorAirMesh.visible = hasAirflow;
                if (hasAirflow && this.cassetteIndoorAirVel) {
                    const airSpeed = (0.8 + this.state.fanSpeed * 0.35) * this.state.timeScale * this.physics.airflowIntensity;
                    const pos = this.cassetteIndoorAirMesh.geometry.attributes.position;
                    for (let i = 0; i < this.cassetteIndoorAirVel.length; i++) {
                        const v = this.cassetteIndoorAirVel[i];
                        let px = pos.getX(i) + v.vx * effectiveDelta * airSpeed;
                        let py = pos.getY(i) + v.vy * effectiveDelta * airSpeed;
                        let pz = pos.getZ(i) + v.vz * effectiveDelta * airSpeed;

                        if (py < -0.15 || Math.abs(px - (-1.6)) > 2.2 || Math.abs(pz) > 2.2) {
                            px = -1.6 + (v.dirIdx === 2 ? 0.5 : v.dirIdx === 3 ? -0.5 : 0);
                            py = 3.12;
                            pz = (v.dirIdx === 0 ? 0.5 : v.dirIdx === 1 ? -0.5 : 0);
                        }
                        pos.setXYZ(i, px, py, pz);
                    }
                    pos.needsUpdate = true;
                }
            }

            if (this.cassetteOutdoorAirMesh) {
                this.cassetteOutdoorAirMesh.visible = hasAirflow;
                if (hasAirflow && this.cassetteOutdoorAirVel) {
                    const airSpeed = (0.9 + this.state.fanSpeed * 0.35) * this.state.timeScale * this.physics.airflowIntensity;
                    const pos = this.cassetteOutdoorAirMesh.geometry.attributes.position;
                    for (let i = 0; i < this.cassetteOutdoorAirVel.length; i++) {
                        const v = this.cassetteOutdoorAirVel[i];
                        let pz = pos.getZ(i) + v.vz * effectiveDelta * airSpeed;
                        if (pz > 2.5) {
                            pz = 0.36;
                        }
                        pos.setZ(i, pz);
                    }
                    pos.needsUpdate = true;
                }
            }
        }

        // 5. Анимация и поворот маркеров к камере
        this.hotspotMeshes.forEach(h => {
            h.group.quaternion.copy(this.camera.quaternion);
            const scale = 1.0 + Math.sin(time * 4) * 0.15;
            h.pulseRing.scale.set(scale, scale, 1);
            h.pulseRing.material.opacity = Math.max(0.05, 0.6 - (scale - 1.0) * 2.0);
        });

        // 6. Анимация Крипера (взвод, мерцание, реакция на климат, дрожь, прыжки и реплики)
        if (this.creeperGroup && this.creeperState) {
            // Анимация взвода перед взрывом (Fuse)
            if (this.creeperState.isPrimed) {
                this.creeperState.fuseTimer -= delta;
                const progress = Math.max(0, (1.5 - this.creeperState.fuseTimer) / 1.5);

                // Надувание (swell) как в Minecraft
                const swell = Math.pow(progress, 1.8) * 0.42;
                this.creeperGroup.scale.set(1 + swell, 1 + swell * 1.35, 1 + swell);

                // Белое мерцание с нарастающей частотой
                const flashFreq = 16 + progress * 24;
                const isWhite = Math.sin(progress * flashFreq * Math.PI) > 0;
                this.setCreeperWhite(isWhite);

                // Вибрация от закипающего пороха
                const shiver = 0.025 * progress;
                this.creeperGroup.position.set(
                    this.creeperBasePos.x + (Math.random() - 0.5) * shiver,
                    this.creeperBasePos.y,
                    this.creeperBasePos.z + (Math.random() - 0.5) * shiver
                );

                if (this.creeperState.fuseTimer <= 0) {
                    this.explodeCreeper();
                }
            } else if (!this.creeperState.isExploded) {
                // Стандартная анимация дыхания / дрожи / прыжков (когда не взорван)
                let shiverX = 0;
                let shiverZ = 0;

                if (this.state.power && this.state.mode === 'cool' && this.physics.airflowIntensity > 0.05) {
                    const coldFactor = Math.max(0.3, (30 - this.state.targetTemp) / 14);
                    const shiverIntensity = 0.016 * coldFactor * this.physics.airflowIntensity;
                    shiverX = Math.sin(time * 46) * shiverIntensity;
                    shiverZ = Math.cos(time * 42) * shiverIntensity;

                    this.creeperHead.rotation.x = 0.12 + Math.sin(time * 44) * 0.04;
                    this.creeperHead.rotation.y = 0;
                    this.creeperBody.scale.y = 1.0;
                } else if (this.state.power && this.state.mode === 'heat' && this.physics.airflowIntensity > 0.05) {
                    this.creeperHead.rotation.x = -0.06 + Math.sin(time * 2.2) * 0.03;
                    this.creeperHead.rotation.y = Math.sin(time * 1.2) * 0.08;
                    this.creeperBody.scale.y = 1.0 + Math.sin(time * 2.2) * 0.025;
                } else {
                    this.creeperHead.rotation.x = 0;
                    this.creeperHead.rotation.y = Math.sin(time * 0.9) * 0.16;
                    this.creeperBody.scale.y = 1.0;
                }

                let jumpY = 0;
                if (this.creeperState.isJumping) {
                    this.creeperState.jumpProgress += delta * 2.6;
                    if (this.creeperState.jumpProgress >= 1.0) {
                        this.creeperState.jumpProgress = 0;
                        this.creeperState.isJumping = false;
                    } else {
                        const jp = this.creeperState.jumpProgress;
                        jumpY = Math.sin(jp * Math.PI) * 0.32;
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
            }

            // Анимация облачка реплик над головой
            if (this.speechBubbleSprite) {
                if (this.creeperState.bubbleTimer > 0 && !this.creeperState.isExploded) {
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

        // 7. Тряска камеры (Screen shake)
        if (this.cameraShakeTimer > 0) {
            this.cameraShakeTimer -= delta;
            const factor = Math.max(0, this.cameraShakeTimer / 0.85);
            const shake = this.cameraShakeIntensity * factor;
            this.camera.position.x += (Math.random() - 0.5) * shake;
            this.camera.position.y += (Math.random() - 0.5) * shake;
            this.camera.position.z += (Math.random() - 0.5) * shake;
        }

        // 8. Обновление воксельных частиц взрыва
        if (this.explosionParticles && this.explosionParticles.length > 0) {
            for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
                const p = this.explosionParticles[i];
                p.life += delta;
                if (p.life >= p.maxLife) {
                    if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
                    if (p.mesh.geometry) p.mesh.geometry.dispose();
                    this.explosionParticles.splice(i, 1);
                    continue;
                }
                const normLife = p.life / p.maxLife;
                p.vel.y -= 3.5 * delta;
                p.vel.multiplyScalar(0.965);
                p.mesh.position.addScaledVector(p.vel, delta);
                p.mesh.rotation.x += p.rotVel.x * delta;
                p.mesh.rotation.y += p.rotVel.y * delta;
                p.mesh.rotation.z += p.rotVel.z * delta;

                const currentScale = p.initScale * (1.0 + normLife * 1.8);
                p.mesh.scale.set(currentScale, currentScale, currentScale);
                p.mesh.material.opacity = Math.max(0, 0.95 * (1.0 - normLife));
            }
        }

        // 9. Физика разлета и сборки обломков кондиционера
        if (this.debrisList && this.debrisList.length > 0) {
            if (this.isRestoring) {
                // Плавная сборка деталей обратно на свои места
                this.restoreProgress += delta / 1.15;
                const t = Math.min(1.0, this.restoreProgress);
                const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                this.debrisList.forEach(item => {
                    const origParent = item.obj.userData.origParent;
                    const targetWorldPos = item.obj.userData.origPosition.clone();
                    origParent.localToWorld(targetWorldPos);

                    item.obj.position.lerpVectors(item.startPos, targetWorldPos, ease);
                    item.obj.rotation.x = item.startRot.x + (item.obj.userData.origRotation.x - item.startRot.x) * ease;
                    item.obj.rotation.y = item.startRot.y + (item.obj.userData.origRotation.y - item.startRot.y) * ease;
                    item.obj.rotation.z = item.startRot.z + (item.obj.userData.origRotation.z - item.startRot.z) * ease;
                });

                if (t >= 1.0) {
                    this.isRestoring = false;
                    this.isACDestroyed = false;

                    // Очищаем электрические искры
                    if (this.electricSparks) {
                        this.electricSparks.forEach(sp => {
                            if (sp.mesh.parent) sp.mesh.parent.remove(sp.mesh);
                            if (sp.mesh.geometry) sp.mesh.geometry.dispose();
                            if (sp.mesh.material) sp.mesh.material.dispose();
                        });
                        this.electricSparks = [];
                    }

                    // Возвращаем все объекты обратно в родительские контейнеры
                    this.debrisList.forEach(item => {
                        const origParent = item.obj.userData.origParent;
                        origParent.attach(item.obj);
                        item.obj.position.copy(item.obj.userData.origPosition);
                        item.obj.rotation.copy(item.obj.userData.origRotation);
                        item.obj.scale.copy(item.obj.userData.origScale);
                    });
                    this.debrisList = [];

                    // Восстанавливаем корректную видимость корпусов и дисплеев
                    const isCassRestore = (this.currentModelId === 'lg_cassette');
                    if (this.indoorGroup) this.indoorGroup.visible = !isCassRestore;
                    if (this.indoorCassetteGroup) this.indoorCassetteGroup.visible = isCassRestore;
                    if (this.outdoorGroup) this.outdoorGroup.visible = !isCassRestore;
                    if (this.outdoorDualGroup) this.outdoorDualGroup.visible = isCassRestore;
                    if (this.pipeGroup) this.pipeGroup.visible = !isCassRestore;
                    if (this.cassettePipeGroup) this.cassettePipeGroup.visible = isCassRestore;

                    if (this.indoorSolidCasing) {
                        this.indoorSolidCasing.visible = !this.state.xray && !isCassRestore;
                    }
                    if (this.outdoorSolidCasing) {
                        this.outdoorSolidCasing.visible = !this.state.xray;
                    }
                    if (this.indoorCaseMesh) {
                        this.indoorCaseMesh.visible = this.state.xray;
                    }
                    if (this.outdoorCaseMesh) {
                        this.outdoorCaseMesh.visible = this.state.xray;
                    }
                    if (this.outdoorFanWireGrill) {
                        this.outdoorFanWireGrill.visible = this.state.xray;
                    }
                    if (this.displayMesh) {
                        this.displayMesh.visible = this.state.xray && this.state.power;
                    }

                    // Восстанавливаем фреон, потоки и вращение ТОЛЬКО если кондиционер включен
                    if (this.state.power) {
                        if (this.refParticlesMesh) this.refParticlesMesh.visible = !isCassRestore;
                        if (this.indoorAirMesh) this.indoorAirMesh.visible = !isCassRestore;
                        if (this.outdoorAirMesh) this.outdoorAirMesh.visible = !isCassRestore;
                        if (this.cassetteIndoorAirMesh) this.cassetteIndoorAirMesh.visible = isCassRestore;
                        if (this.cassetteOutdoorAirMesh) this.cassetteOutdoorAirMesh.visible = isCassRestore;
                        this.physics.refrigerantSpeed = 1.0;
                        this.physics.airflowIntensity = 1.0;
                        const fanRpmPresets = [16, 25, 34, 46];
                        this.physics.fanRpmTarget = fanRpmPresets[this.state.fanSpeed - 1] || 25;
                        this.physics.indoorFanRpmTarget = this.physics.fanRpmTarget * 0.85;
                        this.physics.fanRpmCurrent = this.physics.fanRpmTarget;
                        this.physics.indoorFanRpmCurrent = this.physics.indoorFanRpmTarget;
                        if (window.soundEngine) {
                            window.soundEngine.setPower(true);
                        }
                    } else {
                        if (this.refParticlesMesh) this.refParticlesMesh.visible = false;
                        if (this.indoorAirMesh) this.indoorAirMesh.visible = false;
                        if (this.outdoorAirMesh) this.outdoorAirMesh.visible = false;
                        if (this.cassetteIndoorAirMesh) this.cassetteIndoorAirMesh.visible = false;
                        if (this.cassetteOutdoorAirMesh) this.cassetteOutdoorAirMesh.visible = false;
                        this.physics.refrigerantSpeed = 0.0;
                        this.physics.airflowIntensity = 0.0;
                        this.physics.fanRpmTarget = 0.0;
                        this.physics.indoorFanRpmTarget = 0.0;
                        this.physics.fanRpmCurrent = 0.0;
                        this.physics.indoorFanRpmCurrent = 0.0;
                        this.physics.louverAngle = 0.0;
                    }

                    // Возрождаем крипера
                    this.creeperGroup.visible = true;
                    this.creeperGroup.scale.set(1, 1, 1);
                    this.restoreCreeperMaterials();
                    this.creeperState.isExploded = false;
                    this.creeperState.isPrimed = false;
                    this.creeperState.clickCount = 0;
                    this.creeperState.isJumping = true;
                    this.creeperState.bubbleTimer = 4.2;
                    this.renderSpeechBubble("✨ Ура! Кондиционер снова как новенький!");

                    this.setModel(this.currentModelId);
                    this.updateDigitalDisplay();

                    if (typeof this.onRestoreComplete === 'function') {
                        this.onRestoreComplete();
                    }
                    if (typeof window.onACRestored === 'function') {
                        window.onACRestored();
                    }
                }
            } else {
                // Физическое падение и отскок обломков от пола
                const floorY = -0.22;
                this.debrisList.forEach(item => {
                    if (item.settled) return;

                    item.velocity.y -= 9.8 * delta;

                    item.obj.position.x += item.velocity.x * delta;
                    item.obj.position.y += item.velocity.y * delta;
                    item.obj.position.z += item.velocity.z * delta;

                    item.obj.rotation.x += item.angularVelocity.x * delta;
                    item.obj.rotation.y += item.angularVelocity.y * delta;
                    item.obj.rotation.z += item.angularVelocity.z * delta;

                    if (item.obj.position.y <= floorY) {
                        item.obj.position.y = floorY;
                        item.velocity.y = -item.velocity.y * 0.28;
                        item.velocity.x *= 0.72;
                        item.velocity.z *= 0.72;
                        item.angularVelocity.multiplyScalar(0.70);

                        if (Math.abs(item.velocity.y) < 0.25 && Math.abs(item.velocity.x) < 0.1 && Math.abs(item.velocity.z) < 0.1) {
                            item.settled = true;
                        }
                    }
                });
            }
        }

        // 10. Электрические искры поврежденного индикатора и мерцание дисплея
        if (this.isACDestroyed) {
            this.sparkTimer += delta;
            this.flickerTimer += delta;

            // Периодическое мерцание разбитого LED-экрана с кодами ошибок
            if (this.flickerTimer > 0.16) {
                this.flickerTimer = 0;
                this.updateIndoorFasciaDisplay();
                this.updateDigitalDisplay();
            }

            // Выброс снопа искр каждые 0.14 сек
            if (this.sparkTimer > 0.14) {
                this.sparkTimer = 0;
                this.spawnElectricSparkBurst();
            }
        }

        // Обновление физики искр короткого замыкания
        if (this.electricSparks && this.electricSparks.length > 0) {
            for (let i = this.electricSparks.length - 1; i >= 0; i--) {
                const sp = this.electricSparks[i];
                sp.life += delta;
                if (sp.life >= sp.maxLife) {
                    if (sp.mesh.parent) sp.mesh.parent.remove(sp.mesh);
                    if (sp.mesh.geometry) sp.mesh.geometry.dispose();
                    if (sp.mesh.material) sp.mesh.material.dispose();
                    this.electricSparks.splice(i, 1);
                    continue;
                }
                sp.vel.y -= 12.0 * delta; // гравитация
                sp.mesh.position.addScaledVector(sp.vel, delta);
                const norm = Math.max(0, 1.0 - (sp.life / sp.maxLife));
                sp.mesh.scale.set(norm, norm, norm);
                sp.mesh.material.opacity = norm;
            }
        }

        // 11. Рендеринг сцены
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


    // =========================================================================
    // 4-WAY КАССЕТНЫЙ ВНУТРЕННИЙ БЛОК (LG CASSETTE)
    // =========================================================================
    buildCassetteIndoorUnit() {
        const cassetteGroup = new THREE.Group();
        cassetteGroup.position.set(-1.6, 3.2, 0);

        const width = 1.35;
        const height = 0.42;
        const depth = 1.35;

        // 1. Верхний запотолочный оцинкованный корпус
        const chassisGeo = new THREE.BoxGeometry(width * 0.95, height * 0.85, depth * 0.95);
        const chassisMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.75,
            roughness: 0.35
        });
        const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        chassisMesh.position.set(0, height * 0.12, 0);
        cassetteGroup.add(chassisMesh);
        this.cassetteChassisMesh = chassisMesh;

        // 4 угловых монтажных кронштейна подвеса
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
        for (let bx of [-1, 1]) {
            for (let bz of [-1, 1]) {
                const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), bracketMat);
                bMesh.position.set(bx * (width * 0.48), height * 0.45, bz * (depth * 0.48));
                cassetteGroup.add(bMesh);
            }
        }

        // 2. Декоративная нижняя панель (лицом вниз к комнате)
        const panelMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.18,
            metalness: 0.05
        });
        const panelGeo = new THREE.BoxGeometry(width * 1.05, 0.05, depth * 1.05);
        const panelMesh = new THREE.Mesh(panelGeo, panelMat);
        panelMesh.position.set(0, -height * 0.42, 0);
        cassetteGroup.add(panelMesh);
        this.cassettePanelMesh = panelMesh;

        // Центральная квадратная решетка забора воздуха
        const grillCanvas = document.createElement('canvas');
        grillCanvas.width = 512;
        grillCanvas.height = 512;
        const gCtx = grillCanvas.getContext('2d');
        gCtx.fillStyle = '#0f172a';
        gCtx.fillRect(0, 0, 512, 512);
        gCtx.fillStyle = '#1e293b';
        gCtx.fillRect(20, 20, 472, 472);
        gCtx.fillStyle = '#090d16';
        for (let gx = 35; gx < 480; gx += 24) {
            for (let gy = 35; gy < 480; gy += 24) {
                gCtx.beginPath();
                gCtx.roundRect(gx, gy, 18, 18, 4);
                gCtx.fill();
            }
        }
        gCtx.fillStyle = '#a50034';
        gCtx.beginPath();
        gCtx.arc(256, 492, 12, 0, Math.PI * 2);
        gCtx.fill();

        const grillTex = new THREE.CanvasTexture(grillCanvas);
        const grillGeo = new THREE.PlaneGeometry(width * 0.58, depth * 0.58);
        const grillMat = new THREE.MeshStandardMaterial({ map: grillTex, roughness: 0.5 });
        const intakeGrill = new THREE.Mesh(grillGeo, grillMat);
        intakeGrill.rotation.x = Math.PI / 2;
        intakeGrill.position.set(0, -height * 0.448, 0);
        cassetteGroup.add(intakeGrill);
        this.cassetteIntakeGrill = intakeGrill;

        // 3. Четыре моторизованные направляющие шторки (жалюзи 4-Way)
        this.cassetteLouvers = [];
        const louverMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
        const louverLen = width * 0.65;
        const louverW = 0.08;

        const louverConfigs = [
            { pos: new THREE.Vector3(0, -height * 0.42, depth * 0.44), rotY: 0 },
            { pos: new THREE.Vector3(0, -height * 0.42, -depth * 0.44), rotY: Math.PI },
            { pos: new THREE.Vector3(width * 0.44, -height * 0.42, 0), rotY: -Math.PI / 2 },
            { pos: new THREE.Vector3(-width * 0.44, -height * 0.42, 0), rotY: Math.PI / 2 }
        ];

        louverConfigs.forEach(cfg => {
            const pivot = new THREE.Group();
            pivot.position.copy(cfg.pos);
            pivot.rotation.y = cfg.rotY;

            const lMesh = new THREE.Mesh(new THREE.BoxGeometry(louverLen, 0.01, louverW), louverMat);
            lMesh.position.set(0, 0, louverW / 2);
            pivot.add(lMesh);

            cassetteGroup.add(pivot);
            this.cassetteLouvers.push(pivot);
        });

        // 4. ВНУТРЕННИЙ УЗЕЛ: ЦЕНТРОБЕЖНАЯ ТУРБИНА 3D TURBO FAN
        const turboFanGroup = new THREE.Group();
        turboFanGroup.position.set(0, -0.05, 0);

        const hubDiskGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.02, 32);
        const hubMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
        const hubDisk = new THREE.Mesh(hubDiskGeo, hubMat);
        hubDisk.position.set(0, 0.08, 0);
        turboFanGroup.add(hubDisk);

        const shroudRingGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.08, 32, 1, true);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
        const shroudRing = new THREE.Mesh(shroudRingGeo, ringMat);
        shroudRing.position.set(0, -0.04, 0);
        turboFanGroup.add(shroudRing);

        // 16 загнутых лопаток центробежной турбины
        const bladeGeo = new THREE.BoxGeometry(0.016, 0.12, 0.08);
        const bladeMat = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            metalness: 0.6,
            roughness: 0.25,
            transparent: true,
            opacity: 0.88
        });

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const b = new THREE.Mesh(bladeGeo, bladeMat);
            const r = 0.21;
            b.position.set(Math.cos(angle) * r, 0.02, Math.sin(angle) * r);
            b.rotation.y = -angle + 0.55;
            b.rotation.z = 0.22;
            turboFanGroup.add(b);
        }

        cassetteGroup.add(turboFanGroup);
        this.animatedObjects.cassetteTurboFan = turboFanGroup;
        this.cassetteTurboFan = turboFanGroup;

        // Мотор над турбиной
        const motorGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.12, 24);
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.2 });
        const motorMesh = new THREE.Mesh(motorGeo, motorMat);
        motorMesh.position.set(0, 0.15, 0);
        cassetteGroup.add(motorMesh);
        this.cassetteMotorMesh = motorMesh;

        // 5. ВНУТРЕННИЙ УЗЕЛ: 4-СТОРОННИЙ КРУГОВОЙ ИСПАРИТЕЛЬ (360° COOLING COIL)
        const evapGroup = new THREE.Group();
        evapGroup.position.set(0, 0.0, 0);

        const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x00f2fe,
            metalness: 0.85,
            roughness: 0.2,
            emissive: 0x0284c7,
            emissiveIntensity: 0.35
        });

        const sideW = 0.88;
        const coilH = 0.20;
        const coilDist = 0.38;

        const sideOffsets = [
            { pos: new THREE.Vector3(0, 0, coilDist), rotY: 0 },
            { pos: new THREE.Vector3(0, 0, -coilDist), rotY: Math.PI },
            { pos: new THREE.Vector3(coilDist, 0, 0), rotY: Math.PI / 2 },
            { pos: new THREE.Vector3(-coilDist, 0, 0), rotY: -Math.PI / 2 }
        ];

        sideOffsets.forEach(s => {
            const sideGroup = new THREE.Group();
            sideGroup.position.copy(s.pos);
            sideGroup.rotation.y = s.rotY;

            for (let r = 0; r < 4; r++) {
                const tGeo = new THREE.CylinderGeometry(0.012, 0.012, sideW, 16);
                tGeo.rotateZ(Math.PI / 2);
                const tube = new THREE.Mesh(tGeo, tubeMat);
                tube.position.set(0, (r - 1.5) * 0.045, 0);
                sideGroup.add(tube);
            }

            const finMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.32,
                metalness: 0.9,
                roughness: 0.15
            });
            const finMesh = new THREE.Mesh(new THREE.BoxGeometry(sideW, coilH, 0.04), finMat);
            sideGroup.add(finMesh);

            evapGroup.add(sideGroup);
        });

        cassetteGroup.add(evapGroup);
        this.cassetteEvaporatorGroup = evapGroup;

        // Дренажный поддон
        const trayMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.5 });
        const trayMesh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.025, depth * 0.88), trayMat);
        trayMesh.position.set(0, -height * 0.28, 0);
        cassetteGroup.add(trayMesh);
        this.cassetteDrainTray = trayMesh;

        // Дренажная помпа
        const pumpMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: 0x0369a1 }));
        pumpMesh.position.set(width * 0.35, -height * 0.24, depth * 0.35);
        cassetteGroup.add(pumpMesh);
        this.cassetteDrainPump = pumpMesh;

        cassetteGroup.visible = false;
        this.indoorCassetteGroup = cassetteGroup;
        this.scene.add(cassetteGroup);
    }

    // =========================================================================
    // ВЫСОКИЙ ДВУХВЕНТИЛЯТОРНЫЙ ВНЕШНИЙ БЛОК (LG SMART INVERTER DUAL FAN)
    // =========================================================================
    buildDualFanOutdoorUnit() {
        const dualGroup = new THREE.Group();
        dualGroup.position.set(1.8, 1.35, 0);

        const width = 1.35;
        const height = 1.65;
        const depth = 0.68;

        // 1. Кронштейны
        const bMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 });
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.06), bMat);
        b1.position.set(-0.05, -height / 2 - 0.03, depth / 2 - 0.08);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.06), bMat);
        b2.position.set(-0.05, -height / 2 - 0.03, -depth / 2 + 0.08);
        dualGroup.add(b1);
        dualGroup.add(b2);
        this.dualBracket1 = b1;
        this.dualBracket2 = b2;

        // Панели корпуса
        const caseMat = new THREE.MeshStandardMaterial({ color: 0xf3f5f8, roughness: 0.38, metalness: 0.15 });
        const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), caseMat);
        backMesh.rotation.y = Math.PI;
        backMesh.position.set(0, 0, -depth / 2);
        dualGroup.add(backMesh);
        this.dualBackMesh = backMesh;

        const leftMesh = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), caseMat);
        leftMesh.rotation.y = -Math.PI / 2;
        leftMesh.position.set(-width / 2, 0, 0);
        dualGroup.add(leftMesh);
        this.dualLeftMesh = leftMesh;

        const rightMesh = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), caseMat);
        rightMesh.rotation.y = Math.PI / 2;
        rightMesh.position.set(width / 2, 0, 0);
        dualGroup.add(rightMesh);
        this.dualRightMesh = rightMesh;

        const topMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.04, depth + 0.04), caseMat);
        topMesh.position.set(0, height / 2 + 0.02, 0);
        dualGroup.add(topMesh);
        this.dualTopMesh = topMesh;

        const botMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.04, depth + 0.02), caseMat);
        botMesh.position.set(0, -height / 2 - 0.02, 0);
        dualGroup.add(botMesh);
        this.dualBotMesh = botMesh;

        // 2. Лицевая панель с двумя решетками
        const frontTex = this.generateDualFanFrontTexture(width, height);
        const frontMat = new THREE.MeshStandardMaterial({
            map: frontTex,
            transparent: true,
            alphaTest: 0.2,
            roughness: 0.35,
            metalness: 0.12,
            side: THREE.DoubleSide
        });
        const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), frontMat);
        frontMesh.position.set(0, 0, depth / 2 + 0.005);
        dualGroup.add(frontMesh);
        this.dualFrontMesh = frontMesh;

        // 3. Два вентилятора (Верхний и Нижний)
        const fanZ = depth / 2 - 0.14;
        const fanX = -width * 0.14;
        const fanYUpper = height * 0.24;
        const fanYLower = -height * 0.24;

        this.dualFanRotors = [];
        this.dualFanStators = [];

        [fanYUpper, fanYLower].forEach((fy) => {
            const fanCenter = new THREE.Vector3(fanX, fy, fanZ);

            const staticGroup = new THREE.Group();
            staticGroup.position.copy(fanCenter);

            const shroudRadius = 0.34;
            const shroudGeo = new THREE.CylinderGeometry(shroudRadius, shroudRadius + 0.015, 0.14, 36, 1, true);
            shroudGeo.rotateX(Math.PI / 2);
            const sMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });
            staticGroup.add(new THREE.Mesh(shroudGeo, sMat));

            const mGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.12, 20);
            mGeo.rotateX(Math.PI / 2);
            const mMesh = new THREE.Mesh(mGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85 }));
            mMesh.position.set(0, 0, -0.04);
            staticGroup.add(mMesh);

            dualGroup.add(staticGroup);
            this.dualFanStators.push(staticGroup);

            const rotorGroup = new THREE.Group();
            rotorGroup.position.copy(fanCenter);
            rotorGroup.position.z += 0.02;

            const spinGeo = new THREE.CylinderGeometry(0.02, 0.075, 0.09, 24);
            spinGeo.rotateX(Math.PI / 2);
            const spinner = new THREE.Mesh(spinGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 }));
            spinner.position.set(0, 0, 0.03);
            rotorGroup.add(spinner);

            const bladeMat = new THREE.MeshStandardMaterial({
                color: 0x3b4759,
                metalness: 0.55,
                roughness: 0.28,
                side: THREE.DoubleSide
            });
            for (let b = 0; b < 3; b++) {
                const bladeAngle = (b / 3) * Math.PI * 2;
                const bMesh = this.createSickleBladeMesh(bladeMat, false); // false = CCW
                bMesh.rotation.z = bladeAngle;
                bMesh.scale.set(0.92, 0.92, 0.92);
                rotorGroup.add(bMesh);
            }

            dualGroup.add(rotorGroup);
            this.dualFanRotors.push(rotorGroup);
        });

        // 4. Высокий конденсатор (на 2 вентилятора)
        const condGroup = new THREE.Group();
        condGroup.position.set(-width * 0.12, 0, -depth / 2 + 0.07);

        const condTubeMat = new THREE.MeshStandardMaterial({
            color: 0xff4500,
            metalness: 0.85,
            roughness: 0.2,
            emissive: 0xd97706,
            emissiveIntensity: 0.4
        });
        const cPasses = 14;
        for (let p = 0; p < cPasses; p++) {
            const tGeo = new THREE.CylinderGeometry(0.014, 0.014, width * 0.65, 16);
            tGeo.rotateZ(Math.PI / 2);
            const tube = new THREE.Mesh(tGeo, condTubeMat);
            tube.position.set(0, (p - cPasses / 2) * 0.09 + 0.05, 0);
            condGroup.add(tube);
        }

        const finsGeo = new THREE.BoxGeometry(width * 0.68, height * 0.85, 0.08);
        const finsMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            metalness: 0.9,
            roughness: 0.2,
            transparent: true,
            opacity: 0.35
        });
        condGroup.add(new THREE.Mesh(finsGeo, finsMat));
        dualGroup.add(condGroup);
        this.dualCondenserGroup = condGroup;

        // 5. Компрессор и докипатель
        const compGroup = new THREE.Group();
        compGroup.position.set(width * 0.28, -height * 0.22, -0.05);

        const compBodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.62, 32);
        const compMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
        const compBody = new THREE.Mesh(compBodyGeo, compMat);
        compGroup.add(compBody);

        const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), compMat);
        topCap.position.set(0, 0.31, 0);
        compGroup.add(topCap);

        const acc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 24), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 }));
        acc.position.set(-0.24, 0.03, 0);
        compGroup.add(acc);

        dualGroup.add(compGroup);
        this.dualCompressorGroup = compGroup;

        // ТРВ и реверсивный клапан
        const vGroup = new THREE.Group();
        vGroup.position.set(width * 0.36, -height * 0.38, depth * 0.15);
        vGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9 })));
        dualGroup.add(vGroup);
        this.dualExpansionValveGroup = vGroup;

        const revGroup = new THREE.Group();
        revGroup.position.set(width * 0.22, 0.15, -0.05);
        const rMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.20, 16), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85 }));
        rMesh.rotation.z = Math.PI / 2;
        revGroup.add(rMesh);
        dualGroup.add(revGroup);
        this.dualReversingValveGroup = revGroup;

        dualGroup.visible = false;
        this.outdoorDualGroup = dualGroup;
        this.scene.add(dualGroup);
    }

    generateDualFanFrontTexture(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1250;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#f4f6f8';
        ctx.fillRect(0, 0, 1024, 1250);

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 5;
        ctx.strokeRect(10, 10, 1004, 1230);

        const cx = 390;
        const cyUpper = 325;
        const cyLower = 890;
        const radius = 240;
        const hubRadius = 55;

        [cyUpper, cyLower].forEach(cy => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.clip();

            ctx.clearRect(cx - radius, cy - radius, radius * 2, radius * 2);

            ctx.fillStyle = '#f4f6f8';
            ctx.beginPath();
            ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 4;
            ctx.stroke();

            [105, 160, 210, radius - 6].forEach((r, idx) => {
                ctx.strokeStyle = idx === 3 ? '#f4f6f8' : '#e2e8f0';
                ctx.lineWidth = idx === 3 ? 12 : 5;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
            });

            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 6;
            for (let i = 0; i < 36; i++) {
                const angle0 = (i / 36) * Math.PI * 2;
                ctx.beginPath();
                for (let step = 0; step <= 25; step++) {
                    const t = step / 25;
                    const r = hubRadius + t * (radius - 8 - hubRadius);
                    const a = angle0 + Math.pow(t, 1.25) * 1.32;
                    const px = cx + Math.cos(a) * r;
                    const py = cy + Math.sin(a) * r;
                    if (step === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            ctx.restore();

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(20, 600, 660, 16);

        // Сервисная панель справа
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        this.drawRoundRect(ctx, 690, 40, 305, 1170, 24);
        ctx.stroke();

        const lx = 840, ly = 160, lr = 65;
        ctx.fillStyle = '#a50034';
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = lr * 0.12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(lx, ly, lr * 0.64, -Math.PI * 0.75, Math.PI * 0.65);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(lx - lr * 0.10, ly - lr * 0.32);
        ctx.lineTo(lx - lr * 0.10, ly + lr * 0.16);
        ctx.lineTo(lx + lr * 0.18, ly + lr * 0.16);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lx - lr * 0.28, ly - lr * 0.16, lr * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LG', lx, ly + lr + 55);

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText('Smart Inverter', lx, ly + lr + 115);

        [440, 500, 560, 720, 780, 840].forEach(sy => {
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            this.drawRoundRect(ctx, 735, sy, 215, 20, 10);
            ctx.fill();

            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath();
            this.drawRoundRect(ctx, 738, sy + 3, 209, 7, 3);
            ctx.fill();
        });

        const hx = 750, hy = 940, hw = 180, hh = 50;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        this.drawRoundRect(ctx, hx, hy, hw, hh, 12);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        this.drawRoundRect(ctx, hx + 4, hy + 4, hw - 8, hh - 8, 8);
        ctx.fill();

        return new THREE.CanvasTexture(canvas);
    }

    // =========================================================================
    // МЕЖБЛОЧНЫЕ ТРУБКИ КАССЕТНОГО БЛОКА
    // =========================================================================
    buildCassettePiping() {
        const pipeGroup = new THREE.Group();
        this.cassettePipingMeshes = [];

        const gasMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.3 });
        const liquidMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });

        const gasCurve1 = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.0, 3.2, 0.2),
            new THREE.Vector3(-0.45, 2.5, 0.1),
            new THREE.Vector3(-0.16, 1.98, 0.025)
        ]);
        const g1 = new THREE.Mesh(new THREE.TubeGeometry(gasCurve1, 24, 0.022, 12, false), gasMat);
        pipeGroup.add(g1);
        this.cassettePipingMeshes.push(g1);

        const gasCurve2 = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.16, 1.98, 0.025),
            new THREE.Vector3(0.0, 1.92, 0.03),
            new THREE.Vector3(0.18, 1.84, 0.025)
        ]);
        const g2 = new THREE.Mesh(new THREE.TubeGeometry(gasCurve2, 14, 0.022, 12, false), gasMat);
        pipeGroup.add(g2);
        this.cassettePipingMeshes.push(g2);

        const gasCurve3 = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.18, 1.84, 0.025),
            new THREE.Vector3(0.8, 1.6, -0.02),
            new THREE.Vector3(1.7, 1.45, -0.05)
        ]);
        const g3 = new THREE.Mesh(new THREE.TubeGeometry(gasCurve3, 24, 0.022, 12, false), gasMat);
        pipeGroup.add(g3);
        this.cassettePipingMeshes.push(g3);

        const liqCurve1 = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.0, 3.16, 0.15),
            new THREE.Vector3(-0.45, 2.45, 0.07),
            new THREE.Vector3(-0.16, 1.93, -0.02)
        ]);
        const l1 = new THREE.Mesh(new THREE.TubeGeometry(liqCurve1, 24, 0.013, 12, false), liquidMat);
        pipeGroup.add(l1);
        this.cassettePipingMeshes.push(l1);

        const liqCurve2 = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.16, 1.93, -0.02),
            new THREE.Vector3(0.0, 1.88, -0.02),
            new THREE.Vector3(0.18, 1.80, -0.015)
        ]);
        const l2 = new THREE.Mesh(new THREE.TubeGeometry(liqCurve2, 14, 0.013, 12, false), liquidMat);
        pipeGroup.add(l2);
        this.cassettePipingMeshes.push(l2);

        const liqCurve3 = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.18, 1.80, -0.015),
            new THREE.Vector3(0.8, 1.4, 0.05),
            new THREE.Vector3(1.7, 0.95, 0.12)
        ]);
        const l3 = new THREE.Mesh(new THREE.TubeGeometry(liqCurve3, 24, 0.013, 12, false), liquidMat);
        pipeGroup.add(l3);
        this.cassettePipingMeshes.push(l3);

        pipeGroup.visible = false;
        this.cassettePipeGroup = pipeGroup;
        this.scene.add(pipeGroup);
    }

    // =========================================================================
    // ВОЗДУШНЫЕ ПОТОКИ КАССЕТЫ (4 НАПРАВЛЕНИЯ) И ДВУХ ВЕНТИЛЯТОРОВ УЛИЦЫ
    // =========================================================================
    buildCassetteAirflow() {
        // Внутренний поток: 4 струи из жалюзи кассеты
        const indoorCount = 800;
        const inGeo = new THREE.BufferGeometry();
        const inPos = new Float32Array(indoorCount * 3);
        const inVel = [];

        for (let i = 0; i < indoorCount; i++) {
            const dirIdx = i % 4; // 0: +Z, 1: -Z, 2: +X, 3: -X
            let vx = 0, vz = 0;
            if (dirIdx === 0) vz = 1.0;
            else if (dirIdx === 1) vz = -1.0;
            else if (dirIdx === 2) vx = 1.0;
            else vx = -1.0;

            const t = Math.random();
            const sx = -1.6 + vx * (0.6 + t * 1.4);
            const sy = 3.1 - t * 2.2;
            const sz = vz * (0.6 + t * 1.4);

            inPos[i * 3] = sx;
            inPos[i * 3 + 1] = sy;
            inPos[i * 3 + 2] = sz;

            inVel.push({
                vx: vx * (1.2 + Math.random() * 0.8),
                vy: -(1.4 + Math.random() * 0.6),
                vz: vz * (1.2 + Math.random() * 0.8),
                dirIdx: dirIdx
            });
        }

        inGeo.setAttribute('position', new THREE.BufferAttribute(inPos, 3));
        const inMat = new THREE.PointsMaterial({
            color: 0x38bdf8,
            size: 0.05,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.cassetteIndoorAirMesh = new THREE.Points(inGeo, inMat);
        this.cassetteIndoorAirMesh.visible = false;
        this.cassetteIndoorAirVel = inVel;
        this.scene.add(this.cassetteIndoorAirMesh);

        // Уличный поток: два параллельных выдува из верхнего и нижнего вентиляторов
        const outCount = 800;
        const outGeo = new THREE.BufferGeometry();
        const outPos = new Float32Array(outCount * 3);
        const outVel = [];

        for (let i = 0; i < outCount; i++) {
            const isUpper = (i % 2 === 0);
            const cy = isUpper ? (1.35 + 0.40) : (1.35 - 0.40);
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.32;

            const zProgress = Math.random();
            outPos[i * 3] = 1.62 + Math.cos(angle) * r;
            outPos[i * 3 + 1] = cy + Math.sin(angle) * r;
            outPos[i * 3 + 2] = 0.34 + zProgress * 2.2;

            outVel.push({
                cy: cy,
                angle: angle,
                r: r,
                vz: 2.2 + Math.random() * 1.5
            });
        }

        outGeo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
        const outMat = new THREE.PointsMaterial({
            color: 0xf97316,
            size: 0.05,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending
        });

        this.cassetteOutdoorAirMesh = new THREE.Points(outGeo, outMat);
        this.cassetteOutdoorAirMesh.visible = false;
        this.cassetteOutdoorAirVel = outVel;
        this.scene.add(this.cassetteOutdoorAirMesh);
    }

}

window.ACScene = ACScene;
