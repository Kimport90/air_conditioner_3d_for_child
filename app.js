// app.js - Логика пользовательского интерфейса и взаимодействие с 3D сценой

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const acScene = new ACScene(container);

    // Ссылки на элементы интерфейса пульта
    const pwrBtn = document.getElementById('btn-power');
    const pwrIndicator = document.getElementById('power-ind');
    const tempDigits = document.getElementById('screen-temp');
    const modeBadge = document.getElementById('screen-mode');
    const fanSpeedTxt = document.getElementById('screen-fan-txt');
    const fanBars = [
        document.getElementById('bar-1'),
        document.getElementById('bar-2'),
        document.getElementById('bar-3'),
        document.getElementById('bar-4')
    ];

    const tempUpBtn = document.getElementById('btn-temp-up');
    const tempDownBtn = document.getElementById('btn-temp-down');
    const modeBtn = document.getElementById('btn-mode');
    const fanBtn = document.getElementById('btn-fan');
    const turboBtn = document.getElementById('btn-turbo');

    // Кнопки быстрых действий сверху
    const soundToggleBtn = document.getElementById('btn-sound-toggle');
    const xrayToggleBtn = document.getElementById('btn-xray-toggle');
    const slowMoBtn = document.getElementById('btn-slowmo');
    const resetCamBtn = document.getElementById('btn-reset-cam');

    // Карточка узла
    const nodeCard = document.getElementById('node-card');
    const cardTitle = document.getElementById('card-title');
    const cardSubtitle = document.getElementById('card-subtitle');
    const cardDesc = document.getElementById('card-desc');
    const cardCloseBtn = document.getElementById('card-close-btn');
    const cardActionBtn = document.getElementById('card-action-btn');

    // Пилюли быстрого выбора узлов снизу
    const nodePills = document.querySelectorAll('.node-pill');

    let isPowerOn = true;
    let currentTemp = 22;
    let currentModeIndex = 0; // 0: cool, 1: heat, 2: fan
    const modes = [
        { id: 'cool', name: '❄️ ОХЛАЖДЕНИЕ', short: 'COOL ❄️', color: '#00e5ff' },
        { id: 'heat', name: '☀️ ОБОГРЕВ', short: 'HEAT ☀️', color: '#f97316' },
        { id: 'fan', name: '💨 ВЕНТИЛЯЦИЯ', short: 'FAN 💨', color: '#10b981' }
    ];
    let currentFanSpeed = 2; // 1, 2, 3, 4 (turbo)

    // Инициализация звука при первом клике/касании пользователя (требование Safari на iPad и браузеров)
    const initSoundOnGesture = () => {
        if (window.soundEngine) {
            window.soundEngine.init();
            window.soundEngine.setPower(isPowerOn);
        }
        window.removeEventListener('pointerdown', initSoundOnGesture);
        window.removeEventListener('touchstart', initSoundOnGesture);
    };
    window.addEventListener('pointerdown', initSoundOnGesture);
    window.addEventListener('touchstart', initSoundOnGesture, { passive: true });

    // Функция обновления экрана пульта
    function updateRemoteUI() {
        if (!isPowerOn) {
            pwrIndicator.classList.add('off');
            tempDigits.textContent = '--';
            tempDigits.style.color = '#475569';
            modeBadge.textContent = 'ВЫКЛ';
            modeBadge.style.color = '#475569';
            fanSpeedTxt.textContent = 'OFF';
            fanBars.forEach(b => b.classList.remove('active'));
            return;
        }

        pwrIndicator.classList.remove('off');
        const mode = modes[currentModeIndex];
        tempDigits.textContent = `${currentTemp}°`;
        tempDigits.style.color = mode.color;
        modeBadge.textContent = mode.short;
        modeBadge.style.color = mode.color;

        const fanLabels = ['ТИХИЙ', 'СРЕДНИЙ', 'ВЫСОКИЙ', 'ТУРБО ⚡'];
        fanSpeedTxt.textContent = fanLabels[currentFanSpeed - 1] || 'АВТО';

        fanBars.forEach((bar, idx) => {
            if (idx < currentFanSpeed) {
                bar.classList.add('active');
                bar.style.backgroundColor = mode.color;
                bar.style.boxShadow = `0 0 4px ${mode.color}`;
            } else {
                bar.classList.remove('active');
                bar.style.backgroundColor = '#334155';
                bar.style.boxShadow = 'none';
            }
        });
    }

    // 1. Кнопка ВКЛ / ВЫКЛ
    pwrBtn.addEventListener('click', () => {
        isPowerOn = !isPowerOn;
        if (window.soundEngine) {
            window.soundEngine.playRemoteBeep();
            window.soundEngine.setPower(isPowerOn);
        }
        acScene.setPower(isPowerOn);
        updateRemoteUI();
    });

    // 2. Регулировка температуры
    tempUpBtn.addEventListener('click', () => {
        if (!isPowerOn) return;
        if (currentTemp < 30) {
            currentTemp++;
            if (window.soundEngine) window.soundEngine.playRemoteBeep();
            acScene.setTargetTemp(currentTemp);
            updateRemoteUI();
        }
    });

    tempDownBtn.addEventListener('click', () => {
        if (!isPowerOn) return;
        if (currentTemp > 16) {
            currentTemp--;
            if (window.soundEngine) window.soundEngine.playRemoteBeep();
            acScene.setTargetTemp(currentTemp);
            updateRemoteUI();
        }
    });

    // 3. Смена режима (Охлаждение -> Обогрев -> Вентиляция)
    modeBtn.addEventListener('click', () => {
        if (!isPowerOn) return;
        currentModeIndex = (currentModeIndex + 1) % modes.length;
        const newMode = modes[currentModeIndex];
        if (window.soundEngine) window.soundEngine.playRemoteBeep();
        acScene.setMode(newMode.id);
        updateRemoteUI();
    });

    // 4. Скорость вентилятора
    fanBtn.addEventListener('click', () => {
        if (!isPowerOn) return;
        currentFanSpeed = (currentFanSpeed % 4) + 1;
        if (window.soundEngine) window.soundEngine.playRemoteBeep();
        acScene.setFanSpeed(currentFanSpeed);
        updateRemoteUI();
    });

    // 5. Кнопка ТУРБО
    turboBtn.addEventListener('click', () => {
        if (!isPowerOn) return;
        currentFanSpeed = 4;
        if (window.soundEngine) window.soundEngine.playRemoteBeep();
        acScene.setFanSpeed(4);
        updateRemoteUI();
    });

    // 6. Быстрые верхние действия
    soundToggleBtn.addEventListener('click', () => {
        if (window.soundEngine) {
            const isMuted = window.soundEngine.toggleMute();
            soundToggleBtn.innerHTML = isMuted ? '🔇 <span>Звук: Выкл</span>' : '🔊 <span>Звук: Вкл</span>';
            soundToggleBtn.classList.toggle('active', !isMuted);
        }
    });

    xrayToggleBtn.addEventListener('click', () => {
        const isXray = acScene.toggleXray();
        if (window.soundEngine) window.soundEngine.playRemoteBeep();
        xrayToggleBtn.innerHTML = isXray ? '🔍 <span>Рентген: Вкл</span>' : '📦 <span>Корпус: Сплошной</span>';
        xrayToggleBtn.classList.toggle('active', isXray);
    });

    slowMoBtn.addEventListener('click', () => {
        const isSlow = acScene.toggleSlowMo();
        if (window.soundEngine) window.soundEngine.playRemoteBeep();
        slowMoBtn.innerHTML = isSlow ? '⏳ <span>Скорость: Замедленно</span>' : '⚡ <span>Скорость: Обычная</span>';
        slowMoBtn.classList.toggle('active', isSlow);
    });

    resetCamBtn.addEventListener('click', () => {
        if (window.soundEngine) window.soundEngine.playRemoteBeep();
        acScene.resetCamera();
        closeNodeCard();
        nodePills.forEach(p => p.classList.remove('active'));
    });

    // 7. Функция показа карточки узла
    function showNodeInfo(item) {
        cardTitle.textContent = item.title;
        cardSubtitle.textContent = item.subtitle;
        cardDesc.textContent = item.desc;
        nodeCard.classList.add('visible');

        // Подсвечиваем соответствующую пилюлю снизу
        nodePills.forEach(pill => {
            pill.classList.toggle('active', pill.dataset.id === item.id);
        });
    }

    function closeNodeCard() {
        nodeCard.classList.remove('visible');
        nodePills.forEach(pill => pill.classList.remove('active'));
    }

    window.onNodeSelected = showNodeInfo;

    cardCloseBtn.addEventListener('click', () => {
        closeNodeCard();
    });

    cardActionBtn.addEventListener('click', () => {
        acScene.resetCamera();
        closeNodeCard();
    });

    // Клик по пилюлям быстрого выбора снизу
    nodePills.forEach(pill => {
        pill.addEventListener('click', () => {
            const nodeId = pill.dataset.id;
            acScene.selectHotspot(nodeId);
        });
    });

    // 8. Сворачивание и разворачивание пульта управления
    const remoteEl = document.getElementById('remote-control');
    const collapseBtn = document.getElementById('btn-remote-collapse');

    function toggleRemoteCollapse(forceState) {
        if (!remoteEl) return;
        const isCollapsed = forceState !== undefined ? forceState : !remoteEl.classList.contains('collapsed');
        remoteEl.classList.toggle('collapsed', isCollapsed);
        if (window.soundEngine) {
            window.soundEngine.playRemoteBeep();
        }
    }

    if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRemoteCollapse(true);
        });
    }

    if (remoteEl) {
        remoteEl.addEventListener('click', (e) => {
            if (remoteEl.classList.contains('collapsed')) {
                e.stopPropagation();
                toggleRemoteCollapse(false);
            }
        });
    }

    // 9. Сворачивание и разворачивание легенды цикла хладагента
    const legendEl = document.getElementById('flow-legend');
    const legendCollapseBtn = document.getElementById('btn-legend-collapse');

    function toggleLegendCollapse(forceState) {
        if (!legendEl) return;
        const isCollapsed = forceState !== undefined ? forceState : !legendEl.classList.contains('collapsed');
        legendEl.classList.toggle('collapsed', isCollapsed);
        if (window.soundEngine) {
            window.soundEngine.playRemoteBeep();
        }
    }

    if (legendCollapseBtn) {
        legendCollapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLegendCollapse(true);
        });
    }

    if (legendEl) {
        legendEl.addEventListener('click', (e) => {
            if (legendEl.classList.contains('collapsed')) {
                e.stopPropagation();
                toggleLegendCollapse(false);
            }
        });
    }

    // Первоначальное обновление интерфейса
    updateRemoteUI();
});
