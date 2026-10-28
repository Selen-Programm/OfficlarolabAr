
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
  const target = document.getElementById('officeTarget');
  const status = document.getElementById('arStatus');

  // Variables de control de estado de la aplicación
  let arSystem = null;          // Instancia del sistema MindAR
  let active = false;           // Indica si el AR está corriendo activamente
  let starting = false;         // Evita múltiples clics mientras se inicializa
  let closeRequested = false;   // Controla si el usuario solicitó cerrar durante la carga
  let targetFound = false;      // Indica si la imagen objetivo está siendo detectada
  let cardBackgroundReady = false; // Bandera para evitar redibujar la tarjeta 3D múltiples veces

  // 2. GENERACIÓN DE ELEMENTOS 3D (THREE.JS)
  //  * Dibuja de forma procedural la tarjeta de información 3D de la oficina utilizando Three.js.
  //  * Nota: En futuras actualizaciones se evaluará cambiar este formato por HTML/DOM o texturas optimizadas.
  //
  function drawOfficeCard() {
    if (cardBackgroundReady) return;
    const card = document.getElementById('officeMessageCard');

    // Función auxiliar para crear formas poligonales (Shapes) en 2D
    const shapeFor = (points) => {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
      shape.closePath();
      return shape;
    };

    // Coordenadas de los vértices para las capas exterior e interior de la tarjeta
    const outerPoints = [[-.44, .55], [.35, .55], [.47, -.55], [-.55, -.55]];
    const innerPoints = [[-.42, .535], [.335, .535], [.45, -.535], [-.53, -.535]];

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
    makeLayer(outerPoints, '#00e6a0', 0);     // Capa exterior (Borde brillante)
    makeLayer(innerPoints, '#050806', .003);  // Capa interior (Fondo oscuro)

    // Creación del borde lineal decorativo superior
    const offsetOutline = outerPoints.map(([x, y]) => new THREE.Vector3(x + .075, y + .055, -.008));
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(offsetOutline);
    const outline = new THREE.LineLoop(outlineGeometry, new THREE.LineBasicMaterial({
      color: '#00e6a0', transparent: true, opacity: .48
    }));
    outline.renderOrder = 1;
    card.object3D.add(outline);

    cardBackgroundReady = true;
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

  // Evento disparado cuando MindAR detecta la imagen objetivo en el visor
  target.addEventListener('targetFound', () => {
    targetFound = true;
    setStatus('OFICINAS · Marcador reconocido');
  });

  // Evento disparado cuando la imagen objetivo sale del campo de visión de la cámara
  target.addEventListener('targetLost', () => {
    targetFound = false;
    if (active) setStatus('Marcador fuera de vista · volvé a apuntar a la foto');
  });
  // 5. INICIALIZACIÓN Y APERTURA DE LA CÁMARA
  async function openAR() {
    if (active || starting) return;
    closeRequested = false;
    targetFound = false;
    starting = true;
    startButton.disabled = true;
    showScanner('Preparando cámara…');

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
      drawOfficeCard();

      // Configuración del componente MindAR Image Tracking en la escena A-Frame
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

      // Escucha cuando la cámara y MindAR están listos para operar
      scene.addEventListener('arReady', () => {
        if (!closeRequested && !targetFound) setStatus('Cámara lista · apuntá a la foto de la oficina');
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
      if (!targetFound) setStatus('Cámara lista · apuntá a la foto de la oficina');

    } catch (error) {
      if (closeRequested) return;
      const message = String(error?.message || error || '');

      // Clasificación de errores comunes para mostrar mensajes amigables al usuario
      if (/target|mind|fetch|404|load|network|file/i.test(message)) {
        setStatus('No se pudo cargar el marcador de la oficina. Revisá assets/oficina_prueba.mind y la conexión.');
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
    targetFound = false;
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