import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GradientColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

const isCompleteHex = (value: string) => /^#[0-9A-F]{6}$/i.test(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rgbToHex = (red: number, green: number, blue: number) =>
  `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`.toUpperCase();

export default function GradientColorPicker({ value, onChange, label = 'Cor' }: GradientColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewColor = isCompleteHex(value) ? value.toUpperCase() : '#000000';

  const drawGradient = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const hueGradient = ctx.createLinearGradient(0, 0, width, 0);
    hueGradient.addColorStop(0, '#FF0000');
    hueGradient.addColorStop(0.17, '#FF00FF');
    hueGradient.addColorStop(0.33, '#0000FF');
    hueGradient.addColorStop(0.5, '#00FFFF');
    hueGradient.addColorStop(0.67, '#00FF00');
    hueGradient.addColorStop(0.83, '#FFFF00');
    hueGradient.addColorStop(1, '#FF0000');
    ctx.fillStyle = hueGradient;
    ctx.fillRect(0, 0, width, height);

    const whiteGradient = ctx.createLinearGradient(0, 0, 0, height / 2);
    whiteGradient.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGradient;
    ctx.fillRect(0, 0, width, height / 2);

    const blackGradient = ctx.createLinearGradient(0, height / 2, 0, height);
    blackGradient.addColorStop(0, 'rgba(0,0,0,0)');
    blackGradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGradient;
    ctx.fillRect(0, height / 2, width, height / 2);
  }, []);

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    drawGradient(node);
  }, [drawGradient]);

  const updateColorFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clamp((clientX - rect.left) * (canvas.width / rect.width), 0, canvas.width - 1);
    const y = clamp((clientY - rect.top) * (canvas.height / rect.height), 0, canvas.height - 1);
    const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;

    onChange(rgbToHex(pixel[0], pixel[1], pixel[2]));
  }, [onChange]);

  useEffect(() => {
    if (!open) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleDocumentPointerUp = () => setIsDragging(false);

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    document.addEventListener('pointerup', handleDocumentPointerUp, true);
    document.addEventListener('pointercancel', handleDocumentPointerUp, true);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      document.removeEventListener('pointerup', handleDocumentPointerUp, true);
      document.removeEventListener('pointercancel', handleDocumentPointerUp, true);
    };
  }, [open]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
    updateColorFromPointer(event.clientX, event.clientY);
  }, [updateColorFromPointer]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    event.preventDefault();
    event.stopPropagation();
    updateColorFromPointer(event.clientX, event.clientY);
  }, [isDragging, updateColorFromPointer]);

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsDragging(false);
  }, []);

  return (
    <div ref={containerRef} className="relative space-y-3" data-testid="gradient-color-picker">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-w-[144px] justify-start gap-3"
          data-testid="color-picker-trigger"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span
            className="h-6 w-6 rounded-md border border-border shadow-inner"
            style={{ backgroundColor: previewColor }}
          />
          <span className="font-mono text-sm">{value.toUpperCase()}</span>
        </Button>

        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(nextValue)) onChange(nextValue.toUpperCase());
          }}
          maxLength={7}
          className="w-28 font-mono text-sm"
          placeholder="#000000"
          data-testid="color-picker-input"
        />

        <input
          type="color"
          value={previewColor}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
          data-testid="native-color-input"
        />
      </div>

      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-2 w-[320px] space-y-3 rounded-md border bg-popover p-4 text-popover-foreground shadow-md"
          data-testid="gradient-color-popover"
        >
          <p className="text-xs text-muted-foreground">Clique ou arraste no gradiente para atualizar a cor em tempo real.</p>
          <div className="relative overflow-hidden rounded-lg border border-border cursor-crosshair">
            <canvas
              ref={setCanvasRef}
              width={300}
              height={150}
              className="h-[160px] w-full touch-none"
              data-testid="gradient-color-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            />
          </div>
        </div>
      )}
    </div>
  );
}
