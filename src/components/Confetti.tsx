"use client";

const COLORS = ["var(--gus-orange)", "var(--gus-yellow)", "var(--gus-cyan)", "var(--gus-lime)", "var(--gus-pink)"];

type Piece = {
  id: number;
  left: string;
  x: string;
  dx: string;
  dur: string;
  color: string;
};

export function makeConfettiPieces(count = 40): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    x: "0px",
    dx: `${(Math.random() - 0.5) * 200}px`,
    dur: `${1.6 + Math.random() * 1.2}s`,
    color: COLORS[i % COLORS.length],
  }));
}

export default function Confetti({ pieces }: { pieces: Piece[] }) {
  if (pieces.length === 0) return null;
  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.color,
            ["--x" as string]: p.x,
            ["--dx" as string]: p.dx,
            ["--dur" as string]: p.dur,
          }}
        />
      ))}
    </>
  );
}
