// Iconos SVG a mano, un componente por tipo de producto. Sin librería de
// iconos (CLAUDE.md: cero dependencias nuevas).
const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconSofa(props) {
  return (
    <svg {...common} {...props}>
      <path d="M4 12v6h16v-6" />
      <path d="M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
      <path d="M6 10V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <path d="M4 15h16" />
    </svg>
  )
}

export function IconCama(props) {
  return (
    <svg {...common} {...props}>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 14h18" />
      <path d="M3 18v2M21 18v2" />
      <path d="M6 12V9a2 2 0 0 1 2-2h2v5" />
    </svg>
  )
}

export function IconMesa(props) {
  return (
    <svg {...common} {...props}>
      <path d="M3 8h18" />
      <path d="M6 8v10M18 8v10" />
    </svg>
  )
}

export function IconLampara(props) {
  return (
    <svg {...common} {...props}>
      <path d="M8 4h8l3 6H5z" />
      <path d="M12 10v10" />
      <path d="M9 20h6" />
    </svg>
  )
}

export function IconEstante(props) {
  return (
    <svg {...common} {...props}>
      <path d="M4 5h16M4 12h16M4 19h16" />
      <path d="M6 5v14M18 5v14" />
    </svg>
  )
}

export function IconAlfombra(props) {
  return (
    <svg {...common} {...props}>
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
      <path d="M7 9h10M7 12h10M7 15h10" />
    </svg>
  )
}

export function IconGenerico(props) {
  return (
    <svg {...common} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 15l4-4 4 4 4-6 4 4" />
    </svg>
  )
}

const ICONS = {
  sofa: IconSofa,
  cama: IconCama,
  mesa: IconMesa,
  lampara: IconLampara,
  estante: IconEstante,
  alfombra: IconAlfombra,
}

/** Icono por tipo de producto, con fallback genérico. */
export function ProductIcon({ kind, ...props }) {
  const Cmp = ICONS[kind] || IconGenerico
  return <Cmp {...props} />
}

export function IconEngranaje(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </svg>
  )
}

export function IconCopiar(props) {
  return (
    <svg {...common} {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function IconCheck(props) {
  return (
    <svg {...common} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function IconCarpeta(props) {
  return (
    <svg {...common} {...props}>
      <path d="M4 5h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

/** Etiqueta de producto: se usa en vez de IconCarpeta donde la carpeta se
 * trata como una categoría/etiqueta del artículo, no como un archivador. */
export function IconEtiqueta(props) {
  return (
    <svg {...common} {...props}>
      <path d="M12.6 2.6 21 11l-9 9-8.4-8.4A2 2 0 0 1 3 10.2V4a1 1 0 0 1 1-1h6.2a2 2 0 0 1 1.4.6Z" />
      <circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconChevronRight(props) {
  return (
    <svg {...common} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function IconMasOpciones(props) {
  return (
    <svg {...common} fill="currentColor" stroke="none" {...props}>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}

export function IconTodos(props) {
  return (
    <svg {...common} {...props}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  )
}

export function IconMenu(props) {
  return (
    <svg {...common} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function IconActualizar(props) {
  return (
    <svg {...common} {...props}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </svg>
  )
}

export function IconComparar(props) {
  return (
    <svg {...common} {...props}>
      <path d="M7 8h13M7 16h13M3 8h.01M3 16h.01" />
    </svg>
  )
}
