(() => {
  const startButton = document.getElementById('startAR');
  const closeButton = document.getElementById('closeAR');
  const welcomePanel = document.getElementById('welcomePanel');
  const scanPanel = document.getElementById('scanPanel');
  const scene = document.getElementById('arScene');
  const target = document.getElementById('officeTarget');
  const status = document.getElementById('arStatus');
  let arSystem = null;
  let active = false;
  let starting = false;
  let closeRequested = false;
  let targetFound = false;
  let cardBackgroundReady = false;

  function drawOfficeCard() {
    if (cardBackgroundReady) return;
    const card = document.getElementById('officeMessageCard');
    const shapeFor = (points) => {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
      shape.closePath();
      return shape;
    };
    const outerPoints = [[-.44, .55], [.35, .55], [.47, -.55], [-.55, -.55]];
    const innerPoints = [[-.42, .535], [.335, .535], [.45, -.535], [-.53, -.535]];
    const makeLayer = (points, color, z) => {
      const geometry = new THREE.ShapeGeometry(shapeFor(points));
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      mesh.renderOrder = z > 0 ? 2 : 1;
      card.object3D.add(mesh);
    };

    makeLayer(outerPoints, '#00e6a0', 0);
    makeLayer(innerPoints, '#050806', .003);

    const offsetOutline = outerPoints.map(([x, y]) => new THREE.Vector3(x + .075, y + .055, -.008));
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(offsetOutline);
    const outline = new THREE.LineLoop(outlineGeometry, new THREE.LineBasicMaterial({
      color: '#00e6a0', transparent: true, opacity: .48
    }));
    outline.renderOrder = 1;
    card.object3D.add(outline);
    cardBackgroundReady = true;
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function showScanner(message) {
    welcomePanel.hidden = true;
    scanPanel.classList.add('is-visible');
    scanPanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ar-active');
    setStatus(message);
  }

  function restoreWelcome() {
    scanPanel.classList.remove('is-visible');
    scanPanel.setAttribute('aria-hidden', 'true');
    welcomePanel.hidden = false;
    document.body.classList.remove('ar-active');
    startButton.focus({ preventScroll: true });
  }

  function waitForScene() {
    if (scene.hasLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        scene.removeEventListener('loaded', onLoaded);
        reject(new Error('La escena AR no terminó de cargar.'));
      }, 10000);
      function onLoaded() {
        window.clearTimeout(timeout);
        resolve();
      }
      scene.addEventListener('loaded', onLoaded, { once: true });
      if (scene.hasLoaded) onLoaded();
    });
  }

  target.addEventListener('targetFound', () => {
    targetFound = true;
    setStatus('OFICINAS · Marcador reconocido');
  });

  target.addEventListener('targetLost', () => {
    targetFound = false;
    if (active) setStatus('Marcador fuera de vista · volvé a apuntar a la foto');
  });

  async function openAR() {
    if (active || starting) return;
    closeRequested = false;
    targetFound = false;
    starting = true;
    startButton.disabled = true;
    showScanner('Preparando cámara…');

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('La cámara necesita HTTPS o abrir el sitio en localhost.');
      starting = false;
      startButton.disabled = false;
      return;
    }

    try {
      await waitForScene();
      if (closeRequested) return;
      drawOfficeCard();

      scene.setAttribute('mindar-image', {
        imageTargetSrc: './assets/oficina_prueba.mind',
        autoStart: false,
        uiLoading: 'no',
        uiScanning: 'no',
        filterMinCF: 0.0001,
        filterBeta: 0.01,
        warmupTolerance: 5,
        missTolerance: 12,
        maxTrack: 1
      });
      scene.addEventListener('arReady', () => {
        if (!closeRequested && !targetFound) setStatus('Cámara lista · apuntá a la foto de la oficina');
      }, { once: true });
      scene.addEventListener('arError', (event) => {
        if (closeRequested) return;
        const reason = String(event.detail?.error?.message || event.detail?.error || '');
        setStatus(/permission|denied|notallowed/i.test(reason)
          ? 'No se habilitó la cámara. Permití el acceso desde el navegador.'
          : 'No se pudo abrir la cámara. Revisá conexión y permisos.');
      }, { once: true });

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (closeRequested) return;
      arSystem = scene.systems['mindar-image-system'];
      if (!arSystem) throw new Error('MindAR no se pudo cargar. Revisá tu conexión.');
      setStatus('Activando cámara…');
      await arSystem.start();
      if (closeRequested) return;
      active = true;
      if (!targetFound) setStatus('Cámara lista · apuntá a la foto de la oficina');
    } catch (error) {
      if (closeRequested) return;
      const message = String(error?.message || error || '');
      if (/target|mind|fetch|404|load|network|file/i.test(message)) {
        setStatus('No se pudo cargar el marcador de la oficina. Revisá assets/oficina_prueba.mind y la conexión.');
      } else if (/permission|denied|notallowed|secure|camera/i.test(message)) {
        setStatus('La cámara necesita permiso y una página servida desde HTTPS o localhost.');
      } else {
        setStatus('No se pudo iniciar el escáner. Revisá permisos y volvé a intentar.');
      }
    } finally {
      if (closeRequested) {
        const currentSystem = arSystem || scene.systems['mindar-image-system'];
        try { await currentSystem?.stop(); } catch { /* La cámara ya estaba detenida. */ }
        scene.removeAttribute('mindar-image');
        arSystem = null;
        active = false;
      }
      starting = false;
      startButton.disabled = false;
      if (closeRequested) restoreWelcome();
    }
  }

  async function closeAR() {
    if (!scanPanel.classList.contains('is-visible')) return;
    closeRequested = true;
    targetFound = false;
    const currentSystem = arSystem || scene.systems['mindar-image-system'];

    if (starting) {
      restoreWelcome();
      try { await currentSystem?.stop(); } catch { /* La inicialización todavía no había arrancado. */ }
      return;
    }

    active = false;
    restoreWelcome();
    try { await currentSystem?.stop(); } catch { /* La cámara ya estaba detenida. */ }
    scene.removeAttribute('mindar-image');
    arSystem = null;
    startButton.disabled = false;
    closeRequested = false;
  }

  startButton.addEventListener('click', openAR);
  closeButton.addEventListener('click', closeAR);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && scanPanel.classList.contains('is-visible')) closeAR();
  });
})();
