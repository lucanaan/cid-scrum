// Ilustrações no traço do banner da CID (linha arredondada, levemente irregular).
// Todas são decorativas: escondidas de leitores de tela e sem capturar cliques.
import type { CSSProperties } from 'react';

export const CID = {
  navy: '#1b4f8f',
  sky: '#5aa6e6',
  teal: '#33c6cc',
  pink: '#ff5c7a',
  orange: '#ff9433',
  yellow: '#ffc83d',
  coral: '#ff7a5c',
  mist: '#d9ebfa',
  cream: '#fdf3c9',
};

interface DoodleProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

function svgProps(viewBox: string, width: number, height: number, { className, style }: DoodleProps) {
  return {
    viewBox,
    width,
    height,
    className: `doodle ${className ?? ''}`,
    style,
    'aria-hidden': true,
    focusable: false,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export function Cloud(p: DoodleProps) {
  const w = p.size ?? 90;
  return (
    <svg {...svgProps('0 0 120 60', w, w / 2, p)}>
      <path
        d="M20 50c-10 1-15-7-11-13 3-5 9-6 13-4 0-10 10-17 20-13 4-11 19-15 28-6 7-6 19-2 20 8 9-1 15 6 12 13-2 5-7 7-12 7z"
        stroke={CID.sky}
        strokeWidth="3"
        transform="rotate(-6 60 30)"
      />
    </svg>
  );
}

export function Sparkle(p: DoodleProps) {
  const w = p.size ?? 36;
  return (
    <svg {...svgProps('0 0 40 40', w, w, p)} stroke={CID.coral} strokeWidth="3.4">
      <path d="M20 4.5 20.6 35.5M5 19.4 35 20.8M9 9l22.4 22.2M31 8.6 9.4 31.4" />
    </svg>
  );
}

/** Três traços de "brilho", como os ao redor do carrinho no banner. */
export function Burst({ color = CID.coral, ...p }: DoodleProps & { color?: string }) {
  const w = p.size ?? 32;
  return (
    <svg {...svgProps('0 0 40 40', w, w, p)} stroke={color} strokeWidth="3.6">
      <path d="M8 22 3 26M15 13 13.5 4.5M25 15.5 32 9" />
    </svg>
  );
}

export function Tree({ color = CID.teal, ...p }: DoodleProps & { color?: string }) {
  const w = p.size ?? 34;
  return (
    <svg {...svgProps('0 0 40 60', w, w * 1.5, p)}>
      <path d="M20 8c9 4 12 16 10 24-2 7-7 10-10 10s-9-3-10-10C8 23 11 12 20 8z" fill={color} stroke={CID.navy} strokeOpacity=".25" strokeWidth="1.5" />
      <path d="M20 56V22M20 36l-6-6M20 31l5-5" stroke={CID.navy} strokeWidth="2.4" />
    </svg>
  );
}

/** Barras coloridas com a curva da montanha-russa e o carrinho: a marca do app. */
export function BarsCoaster(p: DoodleProps) {
  const w = p.size ?? 120;
  const bar = (x: number, h: number, fill: string) => (
    <rect x={x} y={70 - h} width="13" height={h} rx="3" fill={fill} stroke={CID.navy} strokeOpacity=".15" strokeWidth="1" />
  );
  return (
    <svg {...svgProps('0 0 120 76', w, (w * 76) / 120, p)}>
      {bar(14, 14, CID.teal)}
      {bar(32, 25, CID.pink)}
      {bar(50, 36, CID.orange)}
      {bar(68, 48, CID.yellow)}
      {bar(86, 32, CID.navy)}
      <path d="M8 71C40 70 60 46 74 28c8-10 16-15 24-11 8 4 9 16 2 28" stroke={CID.navy} strokeWidth="4" />
      <path d="M6 67c18-1 30-6 40-14" stroke={CID.navy} strokeWidth="2" strokeDasharray="4 5" opacity=".7" />
      <g transform="rotate(28 92 14)">
        <rect x="84" y="7" width="14" height="8" rx="2" fill={CID.yellow} stroke={CID.navy} strokeWidth="1.8" />
        <circle cx="88" cy="5.5" r="1.8" fill={CID.navy} />
        <circle cx="94" cy="5.5" r="1.8" fill={CID.navy} />
      </g>
      <path d="M104 6l3-4M108 11l5-1" stroke={CID.coral} strokeWidth="2.4" />
      <path d="M2 71.5h116" stroke={CID.navy} strokeWidth="2" />
    </svg>
  );
}

export function DashedCurve(p: DoodleProps) {
  const w = p.size ?? 240;
  return (
    <svg {...svgProps('0 0 240 60', w, w / 4, p)}>
      <path d="M2 40C40 10 80 8 110 26s60 30 128-6" stroke={CID.sky} strokeWidth="2.4" strokeDasharray="7 7" />
    </svg>
  );
}

/** Mancha suave de fundo, como os morros do banner. */
export function Blob({ color = CID.mist, ...p }: DoodleProps & { color?: string }) {
  const w = p.size ?? 420;
  return (
    <svg {...svgProps('0 0 200 120', w, w * 0.6, p)}>
      <path d="M10 110C0 70 30 30 70 34c20 2 26-26 58-24 40 3 70 40 62 72-6 24-40 30-90 30S14 126 10 110z" fill={color} />
    </svg>
  );
}

/** Nuvem + árvores, para estados vazios. */
export function EmptyIllustration() {
  return (
    <div className="empty-illustration" aria-hidden>
      <Cloud size={70} style={{ position: 'absolute', left: 6, top: 0 }} />
      <Sparkle size={18} style={{ position: 'absolute', right: 18, top: 6 }} />
      <Tree size={24} style={{ position: 'absolute', left: 52, bottom: 0 }} />
      <Tree size={32} color={CID.yellow} style={{ position: 'absolute', left: 74, bottom: 0 }} />
      <Tree size={20} style={{ position: 'absolute', left: 104, bottom: 0 }} />
    </div>
  );
}
