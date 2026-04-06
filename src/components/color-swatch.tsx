import { Button } from "@/components/ui/button";

interface ColorSwatchProps {
  sourceColor: string;
  targetColor: string;
  filamentName: string;
  deltaE: number;
  onOverride?: () => void;
}

function deltaEColorClass(deltaE: number): string {
  if (deltaE < 5) return "text-green-600";
  if (deltaE < 10) return "text-yellow-600";
  return "text-red-600";
}

export function ColorSwatch({
  sourceColor,
  targetColor,
  filamentName,
  deltaE,
  onOverride,
}: ColorSwatchProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      {/* Source color swatch */}
      <div
        className="h-10 w-10 rounded shrink-0 border border-border"
        style={{ backgroundColor: sourceColor }}
        title={`Source: ${sourceColor}`}
      />

      {/* Arrow */}
      <span className="text-muted-foreground text-sm shrink-0">→</span>

      {/* Target color swatch */}
      <div
        className="h-10 w-10 rounded shrink-0 border border-border"
        style={{ backgroundColor: targetColor }}
        title={`Filament: ${targetColor}`}
      />

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{filamentName}</span>
        <span className={`text-xs font-mono ${deltaEColorClass(deltaE)}`}>
          ΔE {deltaE.toFixed(1)}
        </span>
      </div>

      {/* Optional override button */}
      {onOverride && (
        <Button
          variant="outline"
          size="sm"
          className="ml-auto shrink-0"
          onClick={onOverride}
        >
          Change
        </Button>
      )}
    </div>
  );
}
