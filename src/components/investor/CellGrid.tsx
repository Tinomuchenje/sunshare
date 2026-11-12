// A small solar panel drawn as a grid of cells that fills as funding grows.

interface CellGridProps {
  /** 0-100 */
  fundedPct: number;
  /** 0-100, the visitor's own share; shown in green when above zero. */
  yourPct?: number;
  columns: number;
  rows: number;
  label: string;
  className?: string;
}

export function CellGrid({
  fundedPct,
  yourPct = 0,
  columns,
  rows,
  label,
  className = "",
}: CellGridProps) {
  const count = columns * rows;
  const sold = Math.round((Math.min(100, fundedPct) / 100) * count);
  // A tiny share still gets one cell so owners can see themselves.
  const yours = yourPct > 0 ? Math.min(sold, Math.max(1, Math.round((yourPct / 100) * count))) : 0;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${columns * 10} ${rows * 10}`}
      className={`block h-auto w-full ${className}`}
    >
      {Array.from({ length: count }, (_, i) => {
        // Fill column by column so the panel reads left to right.
        const col = Math.floor(i / rows);
        const row = i % rows;
        const fill =
          i < yours ? "var(--color-green)" : i < sold ? "var(--color-sun)" : "var(--color-line)";
        return (
          <rect
            key={i}
            x={col * 10 + 1}
            y={row * 10 + 1}
            width={8}
            height={8}
            rx={1.5}
            fill={fill}
          />
        );
      })}
    </svg>
  );
}
