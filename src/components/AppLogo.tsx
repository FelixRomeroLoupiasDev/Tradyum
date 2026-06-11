import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
  zoom?: number; // Zoom level / scale multiplier (e.g., 1 to 3)
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = '',
  size = 120,
  zoom = 1,
}) => {
  // Original viewBox coordinates centered around 50, 50
  // Standard outer points:
  // N: (50, 10), E: (90, 50), S: (50, 90), W: (10, 50)
  // Inner points:
  // NW: (42, 42), NE: (58, 42), SE: (58, 58), SW: (42, 58)
  
  // We can calculate dynamic viewBox or scale the SVG contents around the center (50, 50)
  // To simulate "zoom in" inside the same container, we can adjust the viewBox!
  // Normal viewBox is 0 0 100 100.
  // Zooming in means we shrink the viewBox coordinates towards the center (50, 50).
  // For zoom = 1: viewSize = 100 -> viewBox = "0 0 100 100"
  // For zoom = 1.5: viewSize = 100 / 1.5 = 66.6 -> viewBox centered around 50,50
  // Centered formulas:
  // minX = 50 - (50 / zoom)
  // minY = 50 - (50 / zoom)
  // width = 100 / zoom
  // height = 100 / zoom
  const viewBoxSize = 100 / zoom;
  const minX = 50 - viewBoxSize / 2;
  const minY = 50 - viewBoxSize / 2;
  const viewBoxStr = `${minX} ${minY} ${viewBoxSize} ${viewBoxSize}`;

  return (
    <div 
      className={`relative inline-block overflow-hidden rounded-full transition-transform duration-300 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={viewBoxStr}
        className="w-full h-full select-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ambient glow backing the logo */}
        <circle cx="50" cy="50" r="42" fill="url(#logoGlow)" opacity="0.15" />

        {/* Master shadow/definition filter */}
        <defs>
          <radialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
          </radialGradient>
          <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        <g filter="url(#logoShadow)">
          {/* Background Ring - centered perfect circle, passing behind star points */}
          <circle 
            cx="50" 
            cy="50" 
            r="23" 
            fill="none" 
            stroke="#0a0210" 
            strokeWidth="6.5" 
          />
          <circle 
            cx="50" 
            cy="50" 
            r="23" 
            fill="none" 
            stroke="#c084fc" 
            strokeWidth="0.8" 
            opacity="0.3"
          />

          {/* ===== Alternating Compass Star Quadrants ===== */}
          
          {/* NORTH POINT - LEFT HALF (WHITE) */}
          <polygon
            points="50,50 42,42 50,11"
            fill="#ffffff"
            stroke="#0a0210"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* NORTH POINT - RIGHT HALF (BLUE) */}
          <polygon
            points="50,50 58,42 50,11"
            fill="#2b59c3"
            stroke="#0a0210"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* EAST POINT - TOP HALF (BLUE) */}
          <polygon
            points="50,50 58,42 89,50"
            fill="#2b59c3"
            stroke="#0a0210"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* EAST POINT - BOTTOM HALF (WHITE) */}
          <polygon
            points="50,50 58,58 89,50"
            fill="#ffffff"
            stroke="#0a0210"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* SOUTH POINT - RIGHT HALF (WHITE) */}
          <polygon
            points="50,50 58,58 50,89"
            fill="#ffffff"
            stroke="#0a0210"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* SOUTH POINT - LEFT HALF (BLUE) */}
          <polygon
            points="50,50 42,58 50,89"
            fill="#2b59c3"
            stroke="#0a0210"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* WEST POINT - BOTTOM HALF (BLUE) */}
          <polygon
            points="50,50 42,58 11,50"
            fill="#2b59c3"
            stroke="#0a0210"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* WEST POINT - TOP HALF (WHITE) */}
          <polygon
            points="50,50 42,42 11,50"
            fill="#ffffff"
            stroke="#0a0210"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* Center pinpoint/axis overlay */}
          <circle cx="50" cy="50" r="1.5" fill="#0c0415" />
          <circle cx="50" cy="50" r="0.6" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
};
