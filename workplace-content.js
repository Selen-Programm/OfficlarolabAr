// Cada estación carga su propio .mind y muestra una sola tarjeta asociada a ese archivo.
// targetCount es la cantidad de imágenes incluidas dentro del .mind de esa estación.
window.WORKPLACE_CONTENT = {
  groups: [
    {
      id: 'entrada', file: './assets/targets_entrada.mind', targetCount: 4,
      title: 'BIENVENIDOS', lines: ['Tecnología con alcance global', 'Desarrollo de software', 'Testing, calidad y seguridad', 'Personas en el centro'],
      footer: 'DE JUNÍN AL MUNDO', accent: '#00e6a0', background: '#07140f', visual: 'welcome'
    },
    {
      id: 'oficina2', file: './assets/targets_ofi2.mind', targetCount: 3,
      title: 'OFICINA N.º 1', lines: ['Pasantías escolares', 'Equipos para aprender y crear', 'Computadoras de trabajo', 'Aprendizaje en equipo'],
      footer: 'CLAROLAB · JUNÍN', accent: '#55c8ff', background: '#0b141a', visual: 'workstation'
    },
    {
      id: 'fran', file: './assets/targets_ofiFran.mind', targetCount: 4,
      title: 'FRAN', lines: ['Jefe de proyecto y referente', 'Nos brindó un espacio', 'Compartió tiempo y experiencia', 'Gracias por acompañarnos'],
      footer: 'UN ESPACIO PARA APRENDER', accent: '#c4a1ff', background: '#120d19', visual: 'fran'
    },
    {
      id: 'termica', file: './assets/termica.mind', targetCount: 1,
      title: 'SEGURIDAD', lines: ['Tablero eléctrico', 'Riesgo eléctrico', 'Solo personal autorizado', 'No manipular sin formación'],
      footer: 'CLAROLAB · JUNÍN', accent: '#ffc247', background: '#17130b', visual: 'safety'
    },
    {
      id: 'cuadros', file: './assets/cuadros_color.mind', targetCount: 1,
      title: 'UN GRAN EQUIPO', lines: ['Compañeros que acompañan', 'Un ambiente laboral hermoso', 'Ideas y ayuda compartidas', 'Crecer en colaboración'],
      footer: 'CLAROLAB · JUNÍN', accent: '#ff5c9b', background: '#140d16', visual: 'team'
    }
  ],
  idleAdvanceMs: 30000,
  lostAdvanceMs: 2500
};
