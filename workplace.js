
//  * Módulo de Control de Realidad Aumentada (AR) basado en A-Frame y MindAR.
//  * Gestiona la interfaz de bienvenida, permisos de cámara, carga de marcadores de imagen
//  * y renderizado dinámico de elementos 3D con Three.js.

(() => {
  // 1. SELECCIÓN DE ELEMENTOS DEL DOM Y ESTADOS
  const startButton = document.getElementById('startAR');
  const closeButton = document.getElementById('closeAR');
  const welcomePanel = document.getElementById('welcomePanel');
  const scanPanel = document.getElementById('scanPanel');
  const scene = document.getElementById('arScene');
  const status = document.getElementById('arStatus');
  const content = window.WORKPLACE_CONTENT;
  const routeGroups = content.groups;
  const detectedTargets = new Set();

  // Variables de control de estado de la aplicación
  let arSystem = null;          // Instancia del sistema MindAR
  let active = false;           // Indica si el AR está corriendo activamente
  let starting = false;         // Evita múltiples clics mientras se inicializa
  let closeRequested = false;   // Controla si el usuario solicitó cerrar durante la carga
  let targetEntities = [];
  let currentGroupIndex = 0;
  let routeAdvanceTimer = 0;
  let switchingGroup = false;

  // El fondo de cada tarjeta usa el panel gráfico de Clarolab que ya está en assets.
  function addPanelBackground(card) {
    const panel = document.createElement('a-plane');
    panel.setAttribute('position', '0 0 0');
    panel.setAttribute('width', '.72');
    panel.setAttribute('height', '1.067');
    panel.setAttribute('material', 'shader: flat; src: ./assets/panelpruea.png; transparent: true; side: double');
    card.appendChild(panel);
  }

  function createText(parent, id, value, width, position, color = '#f4f7f5', letterSpacing = '') {
    const text = document.createElement('a-text');
    text.setAttribute('id', id);
    text.setAttribute('value', value);
    text.setAttribute('align', 'center');
    text.setAttribute('color', color);
    text.setAttribute('width', width);
    text.setAttribute('position', position);
    text.setAttribute('font', 'roboto');
    text.setAttribute('shader', 'msdf');
    if (letterSpacing) text.setAttribute('letter-spacing', letterSpacing);
    parent.appendChild(text);
  }

  function buildTargets(group, groupIndex) {
    targetEntities.forEach((entity) => entity.remove());
    targetEntities = [];
    const entities = Array.from({ length: group.targetCount }, (_, index) => {
      const item = group;
      const entity = document.createElement('a-entity');
      entity.setAttribute('mindar-image-target', `targetIndex: ${index}`);
      const card = document.createElement('a-entity');
      card.setAttribute('position', '-.02 .2 .08');
      entity.appendChild(card);
      const targetId = `${item.id}-${index}`;
      addPanelBackground(card);
      createText(card, `${targetId}-brand`, `CLAROLAB · ESTACIÓN ${String(groupIndex + 1).padStart(2, '0')}`, '.38', '-.13 .285 .025', '#00e6a0', '1');
      createText(card, `${targetId}-title`, item.title, '.4', '-.13 .19 .025', '#f4f7f5');
      const divider = document.createElement('a-plane');
      divider.setAttribute('position', '-.13 .135 .024');
      divider.setAttribute('width', '.34');
      divider.setAttribute('height', '.003');
      divider.setAttribute('material', 'shader: flat; color: #00e6a0');
      card.appendChild(divider);
      item.lines.forEach((line, lineIndex) => createText(card, `${targetId}-line-${lineIndex + 1}`, line, '.39', `-.13 ${[.09, .02, -.05, -.12][lineIndex]} .025`));
      createText(card, `${targetId}-footer`, item.footer, '.36', '-.13 -.18 .025', '#00e6a0', '1');
      entity.addEventListener('targetFound', () => {
        if (groupIndex !== currentGroupIndex || !active) return;
        detectedTargets.add(targetId);
        window.clearTimeout(routeAdvanceTimer);
        setStatus(`Punto ${groupIndex + 1} de ${routeGroups.length} · ${item.title}`);
      });
      entity.addEventListener('targetLost', () => {
        detectedTargets.delete(targetId);
        if (active && groupIndex === currentGroupIndex && detectedTargets.size === 0) {
          setStatus(`Punto ${groupIndex + 1} fuera de vista · avanzando al próximo`);
          window.clearTimeout(routeAdvanceTimer);
          routeAdvanceTimer = window.setTimeout(advanceRouteGroup, content.lostAdvanceMs);
        }
      });
      scene.insertBefore(entity, scene.querySelector('a-camera'));
      targetEntities.push(entity);
      return { entity, card };
    });
    return entities;
  }

  // 3. GESTIÓN DE INTERFAZ Y ESTADOS (UI)
  // Actualiza el texto de estado en pantalla para guiar al usuario.
  function setStatus(message) {
    status.textContent = message;
  }

  function scheduleIdleAdvance() {
    window.clearTimeout(routeAdvanceTimer);
    routeAdvanceTimer = window.setTimeout(advanceRouteGroup, content.idleAdvanceMs);
  }

  async function advanceRouteGroup() {
    if (!active || closeRequested || switchingGroup) return;
    switchingGroup = true;
    window.clearTimeout(routeAdvanceTimer);
    detectedTargets.clear();

    const previousController = arSystem?.controller;
    previousController?.stopProcessVideo();
    previousController?.dispose();
    arSystem.anchorEntities = [];

    currentGroupIndex = (currentGroupIndex + 1) % routeGroups.length;
    const group = routeGroups[currentGroupIndex];
    setStatus(`Cargando punto ${currentGroupIndex + 1} de ${routeGroups.length} · ${group.title}`);

    try {
      const targets = buildTargets(group, currentGroupIndex);
      arSystem.imageTargetSrc = group.file;
      arSystem.maxTrack = 1;

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (closeRequested) return;
      if (typeof arSystem._startAR !== 'function') {
        throw new Error('La versión de MindAR no permite cambiar de estación sin detener la cámara.');
      }
      await arSystem._startAR();
      if (active && !closeRequested) {
        setStatus(`Punto ${currentGroupIndex + 1} de ${routeGroups.length} · ${group.title} · enfoca su cartel`);
        scheduleIdleAdvance();
      }
    } catch (error) {
      if (!closeRequested) {
        setStatus(`No se pudo cargar ${group.file}. Revisá el archivo y la conexión.`);
        routeAdvanceTimer = window.setTimeout(advanceRouteGroup, 5000);
      }
    } finally {
      switchingGroup = false;
    }
  }

  /** Oculta la pantalla de bienvenida y muestra el visor de la cámara. */
  function showScanner(message) {
    welcomePanel.hidden = true;
    scanPanel.classList.add('is-visible');
    scanPanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ar-active');
    setStatus(message);
  }

  /** Restaura la interfaz principal ocultando el escáner y devolviendo el foco al botón de inicio. */
  function restoreWelcome() {
    scanPanel.classList.remove('is-visible');
    scanPanel.setAttribute('aria-hidden', 'true');
    welcomePanel.hidden = false;
    document.body.classList.remove('ar-active');
    startButton.focus({ preventScroll: true });
  }

  // 4. CONTROL DE CARGA DE ESCENA Y EVENTOS AR
  /**
   * Promesa que verifica si A-Frame terminó de cargar la escena por completo
   * (con un tiempo límite de seguridad de 10 segundos).
   */
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

  // 5. INICIALIZACIÓN Y APERTURA DE LA CÁMARA
  async function openAR() {
    if (active || starting) return;
    closeRequested = false;
    detectedTargets.clear();
    currentGroupIndex = 0;
    switchingGroup = false;
    starting = true;
    startButton.disabled = true;
    showScanner(`Preparando punto 1 de ${routeGroups.length}…`);
    const group = routeGroups[currentGroupIndex];

    // Validación de seguridad: getUserMedia requiere HTTPS o localhost obligatoriamente
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('La cámara necesita HTTPS o abrir el sitio en localhost.');
      starting = false;
      startButton.disabled = false;
      return;
    }

    try {
      await waitForScene();
      if (closeRequested) return;
      buildTargets(group, currentGroupIndex);

      // Configuración del componente MindAR Image Tracking en la escena A-Frame
      scene.setAttribute('mindar-image', {
        imageTargetSrc: group.file,
        autoStart: false,
        uiLoading: 'no',
        uiScanning: 'no',
        filterMinCF: 0.001,
        filterBeta: 1000,
        warmupTolerance: 8,
        missTolerance: 15,
        maxTrack: 1
      });

      // Escucha cuando la cámara y MindAR están listos para operar
      scene.addEventListener('arReady', () => {
        if (closeRequested) return;
        active = true;
        setStatus(`Punto 1 de ${routeGroups.length} · ${group.title} · enfoca su cartel`);
        scheduleIdleAdvance();
      }, { once: true });

      // Manejo de errores específicos del sistema AR/Cámara
      scene.addEventListener('arError', (event) => {
        if (closeRequested) return;
        const reason = String(event.detail?.error?.message || event.detail?.error || '');
        setStatus(/permission|denied|notallowed/i.test(reason)
          ? 'No se habilitó la cámara. Permití el acceso desde el navegador.'
          : 'No se pudo abrir la cámara. Revisá conexión y permisos.');
      }, { once: true });

      // Espera dos ciclos de renderizado (requestAnimationFrame) para asegurar estabilidad visual
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (closeRequested) return;

      arSystem = scene.systems['mindar-image-system'];
      if (!arSystem) throw new Error('MindAR no se pudo cargar. Revisá tu conexión.');

      setStatus('Activando cámara…');
      arSystem.start(); // Inicia la cámara; el evento arReady marca el comienzo del recorrido.

    } catch (error) {
      if (closeRequested) return;
      const message = String(error?.message || error || '');

      // Clasificación de errores comunes para mostrar mensajes amigables al usuario
      if (/target|mind|fetch|404|load|network|file/i.test(message)) {
        setStatus(`No se pudo cargar ${group.file}. Revisá el archivo y la conexión.`);
      } else if (/permission|denied|notallowed|secure|camera/i.test(message)) {
        setStatus('La cámara necesita permiso y una página servida desde HTTPS o localhost.');
      } else {
        setStatus('No se pudo iniciar el escáner. Revisá permisos y volvé a intentar.');
      }
    } finally {
      // Bloque de limpieza ejecutado al terminar la carga (exitosa o con error)
      if (closeRequested) {
        const currentSystem = arSystem || scene.systems['mindar-image-system'];
        try { await currentSystem?.stop(); } catch { /* La cámara ya estaba detenida */ }
        scene.removeAttribute('mindar-image');
        arSystem = null;
        active = false;
      }
      starting = false;
      startButton.disabled = false;
      if (closeRequested) restoreWelcome();
    }
  }

  // 6. CIERRE Y LIMPIEZA DE RECURSOS DE AR
  async function closeAR() {
    if (!scanPanel.classList.contains('is-visible')) return;
    closeRequested = true;
    active = false;
    window.clearTimeout(routeAdvanceTimer);
    switchingGroup = false;
    detectedTargets.clear();

    if (starting) {
      restoreWelcome();
      return;
    }

    restoreWelcome();
    // Quitar el componente detiene una sola vez el flujo de cámara y el controlador.
    scene.removeAttribute('mindar-image');
    arSystem = null;
    startButton.disabled = false;
    closeRequested = false;
  }

  // 7. REGISTRO DE EVENT LISTENERS GLOBALES
  startButton.addEventListener('click', openAR);
  closeButton.addEventListener('click', closeAR);

  // Permite cerrar el escáner cómodamente presionando la tecla Escape (UX en desktop/teclados)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && scanPanel.classList.contains('is-visible')) closeAR();
  });
})();
