export type MapId = "WAREHOUSE" | "ERANGEL";

function WarehouseMap({ large }: { large: boolean }) {
  const c = (x: number, z: number, w: number, h: number, fill: string, key: string) => (
    <rect key={key} x={150 + x - w / 2} y={110 + z - h / 2} width={w} height={h} fill={fill} rx="1" />
  );
  const containers: [number, number, boolean, string][] = [
    [52, 24, true, "#9a3d2f"], [52, -24, true, "#2f5f94"], [64, 0, false, "#3f7247"], [80, 40, false, "#c46a22"], [80, -40, false, "#6e7378"],
    [44, 52, true, "#3f7247"], [44, -52, true, "#c46a22"], [92, 16, true, "#2f5f94"], [92, -16, true, "#9a3d2f"],
  ];
  return (
    <svg className={`tactical-map ${large ? "large" : ""}`} viewBox="0 0 300 220" aria-label="Warehouse arena tactical map" role="img">
      <defs>
        <pattern id="wh-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0v20" fill="none" stroke="#c9cbbd" strokeOpacity=".12" strokeWidth=".5" />
        </pattern>
      </defs>
      <rect width="300" height="220" fill="#2a2d2b" />
      <rect x="22" y="34" width="256" height="152" fill="#4a4d48" stroke="#d9b53a" strokeWidth="1.5" />
      <rect x="22" y="34" width="256" height="152" fill="url(#wh-grid)" />
      <line x1="150" y1="34" x2="150" y2="186" stroke="#d9b53a" strokeOpacity=".5" strokeDasharray="4 3" />
      <rect x="82" y="66" width="136" height="88" fill="#5e6360" stroke="#8d918b" strokeWidth="1.2" />
      <rect x="118" y="105" width="64" height="10" fill="#7d8185" />
      {containers.flatMap(([x, z, alongX, fill], i) => [
        c(x, z, alongX ? 24 : 10, alongX ? 10 : 24, fill, `a${i}`),
        c(-x, -z, alongX ? 24 : 10, alongX ? 10 : 24, fill, `b${i}`),
      ])}
      <rect x="26" y="50" width="20" height="120" fill="#3b82f6" fillOpacity=".35" stroke="#3b82f6" />
      <rect x="254" y="50" width="20" height="120" fill="#ef4444" fillOpacity=".35" stroke="#ef4444" />
      <text x="36" y="114" fill="#bfdbfe" fontSize="9" fontWeight="700" textAnchor="middle">BLUE</text>
      <text x="264" y="114" fill="#fecaca" fontSize="9" fontWeight="700" textAnchor="middle">RED</text>
      <text x="150" y="26" fill="#e8e3cf" fontSize="9" letterSpacing="2" textAnchor="middle" fontWeight="700">WAREHOUSE · TDM</text>
      {large && <text x="150" y="204" fill="#c9cbbd" fontSize="8" letterSpacing="1.5" textAnchor="middle">CONTAINER YARD · CENTRAL HALL · SYMMETRIC SPAWNS</text>}
    </svg>
  );
}

export default function TacticalMap({ large = false, map = "WAREHOUSE" }: { large?: boolean; map?: MapId }) {
  if (map === "WAREHOUSE") return <WarehouseMap large={large} />;
  return <ErangelMap large={large} />;
}

function ErangelMap({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={`tactical-map ${large ? "large" : ""}`}
      viewBox="0 0 300 220"
      aria-label="Erangel island tactical map"
      role="img"
    >
      <defs>
        <pattern
          id="map-grid"
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M30 0H0v30"
            fill="none"
            stroke="#bcc6aa"
            strokeOpacity=".15"
            strokeWidth=".5"
          />
        </pattern>
        <filter id="map-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".09"
            numOctaves="3"
            seed="8"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope=".22" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <rect width="300" height="220" fill="#192c30" />
      <g filter="url(#map-grain)">
        <path
          d="m40 56 24-22 33 8 18-19 45 10 18-13 29 24 32 8 14 30-5 27 15 21-20 21-6 24-38 8-19-13-27 8-20-10-29 13-26-17-24-3-9-27-18-11 12-30-8-22Z"
          fill="#69725b"
        />
        <path
          d="m116 186 20-8 28 7 21-4 16 17-13 16-32-2-15 7-25-13-19-2 2-15Z"
          fill="#687159"
        />
        <path
          d="m56 65 28 15 20-20 20 15 30-26 32 20 28-3 25 26-24 19-20-9-30 24-32-15-21 13-26-21-25 5Z"
          fill="#525e48"
        />
        <path
          d="m50 122 39-14 23 15 29-3 23 19 27-8 34 17-21 15-31-10-22 12-27-20-21 12-30-13-16 4Z"
          fill="#7a7e5e"
        />
      </g>
      <g stroke="#c9bea1" strokeWidth="1.3" opacity=".7" fill="none">
        <path d="m65 66 37 31 43 5 29-17 44 13 19 39M86 149l22-34 37-13 9 40 23 22M145 102l-5-41M154 143l-6 50M190 150l-15 40" />
        <path d="m55 118 54-2 10 24 37 2 25-22 33 5" strokeWidth=".7" />
      </g>
      <g fill="#c8bf9c" opacity=".8">
        {[
          [96, 94],
          [105, 98],
          [113, 93],
          [137, 99],
          [143, 106],
          [153, 97],
          [154, 106],
          [162, 104],
          [176, 84],
          [184, 86],
          [207, 96],
          [212, 104],
          [110, 136],
          [118, 140],
          [177, 145],
          [183, 151],
          [151, 191],
        ].map(([x, y], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width="4"
            height="3"
            transform={`rotate(${i * 13} ${x} ${y})`}
          />
        ))}
      </g>
      <rect width="300" height="220" fill="url(#map-grid)" />
      <circle
        cx="151"
        cy="103"
        r="30"
        fill="none"
        stroke="#ede6c9"
        strokeOpacity=".5"
        strokeWidth=".7"
      />
      <path d="m151 97 4 10-4-2-4 2 4-10Z" fill="#e9b454" />
      {large && (
        <g fill="#ece8d7" fontSize="7" fontFamily="monospace" letterSpacing="1">
          <text x="126" y="123">
            POCHINKI
          </text>
          <text x="166" y="76">
            ROZHOK
          </text>
          <text x="76" y="86">
            GATKA
          </text>
          <text x="128" y="205">
            MILITARY BASE
          </text>
          <text x="14" y="18" fill="#d5bd86">
            N
          </text>
          <path d="M17 26v14m-3-10 3-4 3 4" stroke="#d5bd86" fill="none" />
        </g>
      )}
    </svg>
  );
}
