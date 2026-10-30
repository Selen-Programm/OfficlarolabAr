
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
  const targetItems = content.groups.flatMap((group) => group.targets);
  const detectedTargets = new Set();

  // Variables de control de estado de la aplicación
  let arSystem = null;          // Instancia del sistema MindAR
  let active = false;           // Indica si el AR está corriendo activamente
  let starting = false;         // Evita múltiples clics mientras se inicializa
  let closeRequested = false;   // Controla si el usuario solicitó cerrar durante la carga
  let cardBackgroundReady = new WeakSet(); // Evita redibujar los fondos de las tarjetas
  let targetEntities = [];

  // 2. GENERACIÓN DE ELEMENTOS 3D (THREE.JS)
  //  * Dibuja de forma procedural la tarjeta de información 3D de la oficina utilizando Three.js.
  //  * Nota: En futuras actualizaciones se evaluará cambiar este formato por HTML/DOM o texturas optimizadas.
  //
  function drawOfficeCard(card, item) {
    if (cardBackgroundReady.has(card)) return;

    // Función auxiliar para crear formas poligonales (Shapes) en 2D
    const shapeFor = (points) => {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
      shape.closePath();
      return shape;
    };

    // Coordenadas de los vértices para las capas exterior e interior de la tarjeta
    const outerPoints = [[-.5, .55], [.32, .55], [.47, .4], [.47, -.55], [-.55, -.55]];
    const innerPoints = [[-.485, .535], [.312, .535], [.455, .394], [.455, -.535], [-.535, -.535]];

    // Función para crear capas planas (Mesh) con geometría y color personalizado
    const makeLayer = (points, color, z) => {
      const geometry = new THREE.ShapeGeometry(shapeFor(points));
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      // renderOrder asegura que las capas se dibujen en el orden correcto de profundidad
      mesh.renderOrder = z > 0 ? 2 : 1;
      card.object3D.add(mesh);
    };

    // Construcción de las capas de fondo
    makeLayer(outerPoints, item.accent, 0);   // Borde con color propio de esta oficina
    makeLayer(innerPoints, item.background, .003);

    // Creación del borde lineal decorativo superior
    const offsetOutline = outerPoints.map(([x, y]) => new THREE.Vector3(x + .075, y + .055, -.008));
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(offsetOutline);
    const outline = new THREE.LineLoop(outlineGeometry, new THREE.LineBasicMaterial({
      color: item.accent, transparent: true, opacity: .48
    }));
    outline.renderOrder = 1;
    card.object3D.add(outline);

    cardBackgroundReady.add(card);
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

  function addOfficeVisual(card, item) {
    if (item.visual === 'safety') {
      const marker = document.createElement('a-cone');
      marker.setAttribute('position', '-.32 .455 .04');
      marker.setAttribute('radius-bottom', '.055');
      marker.setAttribute('radius-top', '0');
      marker.setAttribute('height', '.09');
      marker.setAttribute('segments-radial', '3');
      marker.setAttribute('color', item.accent);
      card.appendChild(marker);
      createText(card, `${item.id}-symbol`, '!', '.045', '-.32 .445 .055', item.background);
      return;
    }

    if (item.visual === 'workstation') {
      const monitor = document.createElement('a-plane');
      monitor.setAttribute('position', '-.32 .455 .04');
      monitor.setAttribute('width', '.12');
      monitor.setAttribute('height', '.075');
      monitor.setAttribute('material', `shader: flat; color: ${item.accent}`);
      card.appendChild(monitor);
      const screen = document.createElement('a-plane');
      screen.setAttribute('position', '-.32 .455 .05');
      screen.setAttribute('width', '.095');
      screen.setAttribute('height', '.05');
      screen.setAttribute('material', `shader: flat; color: ${item.background}`);
      card.appendChild(screen);
      return;
    }

    if (item.visual === 'team' || item.visual === 'fran') {
      const count = item.visual === 'fran' ? 2 : 3;
      for (let index = 0; index < count; index += 1) {
        const person = document.createElement('a-sphere');
        person.setAttribute('position', `${-.36 + index * .07} .47 .045`);
        person.setAttribute('radius', '.018');
        person.setAttribute('color', index === 1 ? item.accent : '#f4f7f5');
        card.appendChild(person);
        const shoulders = document.createElement('a-box');
        shoulders.setAttribute('position', `${-.36 + index * .07} .425 .045`);
        shoulders.setAttribute('width', '.045');
        shoulders.setAttribute('height', '.025');
        shoulders.setAttribute('depth', '.012');
        shoulders.setAttribute('color', item.accent);
        card.appendChild(shoulders);
      }
      return;
    }

    if (item.visual === 'learning' || item.visual === 'quality' || item.visual === 'security') {
      createText(card, `${item.id}-symbol`, item.visual === 'quality' ? '✓' : item.visual === 'security' ? '◆' : '↗', '.09', '-.32 .45 .05', item.accent);
      return;
    }

    ['#fa4f9b', '#ffbf45', '#46c7c2', '#6384ff'].forEach((color, index) => {
      const swatch = document.createElement('a-plane');
      swatch.setAttribute('position', `${-.38 + index * .075} .455 .04`);
      swatch.setAttribute('width', '.055');
      swatch.setAttribute('height', '.045');
      swatch.setAttribute('material', `shader: flat; color: ${color}`);
      card.appendChild(swatch);
    });
  }

  function buildTargets() {
    targetEntities.forEach((entity) => entity.remove());
    targetEntities = [];
    const entities = targetItems.map((item, index) => {
      const entity = document.createElement('a-entity');
      entity.setAttribute('mindar-image-target', `targetIndex: ${index}`);
      const card = document.createElement('a-entity');
      card.setAttribute('position', '-.02 .2 .08');
      entity.appendChild(card);
      createText(card, `${item.id}-title`, item.title, '.73', '0 .34 .025', item.accent, '2');
      addOfficeVisual(card, item);
      const divider = document.createElement('a-plane');
      divider.setAttribute('position', '0 .22 .024');
      divider.setAttribute('width', '.46');
      divider.setAttribute('height', '.004');
      divider.setAttribute('material', `shader: flat; color: ${item.accent}`);
      card.appendChild(divider);
      item.lines.forEach((line, lineIndex) => createText(card, `${item.id}-line-${lineIndex + 1}`, line, '.68', `0 ${[.09, -.02, -.13, -.24][lineIndex]} .025`));
      createText(card, `${item.id}-footer`, item.footer, '.45', '0 -.43 .025', item.accent, '1');
      entity.addEventListener('targetFound', () => {
        detectedTargets.add(item.id);
        setStatus(`${item.title} · Marcador reconocido`);
      });
      entity.addEventListener('targetLost', () => {
        detectedTargets.delete(item.id);
        if (active) {
          const remaining = targetItems.find((target) => detectedTargets.has(target.id));
          setStatus(remaining ? `${remaining.title} · Marcador reconocido` : 'Marcador fuera de vista · seguí el recorrido');
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
    starting = true;
    startButton.disabled = true;
    showScanner('Preparando cámara…');
    const content = window.WORKPLACE_CONTENT;

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
      const targets = buildTargets();
      targets.forEach(({ card }, index) => drawOfficeCard(card, targetItems[index]));

      // Configuración del componente MindAR Image Tracking en la escena A-Frame
      scene.setAttribute('mindar-image', {
        imageTargetSrc: content.mind,
        autoStart: false,
        uiLoading: 'no',
        uiScanning: 'no',
        filterMinCF: 0.0001,
        filterBeta: 0.01,
        warmupTolerance: 5,
        missTolerance: 12,
        maxTrack: targetItems.length
      });

      // Escucha cuando la cámara y MindAR están listos para operar
      scene.addEventListener('arReady', () => {
        if (!closeRequested && detectedTargets.size === 0) setStatus('Cámara lista · seguí el recorrido y enfocá cualquiera de las imágenes');
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
      await arSystem.start(); // Inicia el flujo de video y el procesamiento de imagen

      if (closeRequested) return;
      active = true;
      if (detectedTargets.size === 0) setStatus('Cámara lista · seguí el recorrido y enfocá cualquiera de las imágenes');

    } catch (error) {
      if (closeRequested) return;
      const message = String(error?.message || error || '');

      // Clasificación de errores comunes para mostrar mensajes amigables al usuario
      if (/target|mind|fetch|404|load|network|file/i.test(message)) {
        setStatus(`No se pudo cargar ${content.mind}. Revisá el archivo y la conexión.`);
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
    detectedTargets.clear();
    const currentSystem = arSystem || scene.systems['mindar-image-system'];

    if (starting) {
      restoreWelcome();
      try { await currentSystem?.stop(); } catch { /* Todavía no había arrancado del todo */ }
      return;
    }

    active = false;
    restoreWelcome();

    // Detiene el streaming de la cámara y libera el sistema MindAR
    try { await currentSystem?.stop(); } catch { /* La cámara ya estaba detenida */ }
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
