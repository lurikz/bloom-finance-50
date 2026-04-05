import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GradientColorPicker from '@/components/GradientColorPicker';

const getImageData = vi.fn((x: number, y: number) => ({
  data: new Uint8ClampedArray([Math.round(x), Math.round(y), 128, 255]),
}));

beforeEach(() => {
  getImageData.mockClear();

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      fillRect: vi.fn(),
      getImageData,
    })),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 300,
      height: 150,
      right: 300,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })),
  });
});

function ControlledPicker() {
  const [value, setValue] = useState('#10B981');
  return (
    <div>
      <GradientColorPicker value={value} onChange={setValue} />
      <span data-testid="selected-color">{value}</span>
      <button type="button">fora</button>
    </div>
  );
}

describe('GradientColorPicker', () => {
  it('keeps the picker open and updates the color while dragging on the gradient', () => {
    render(<ControlledPicker />);

    fireEvent.click(screen.getByTestId('color-picker-trigger'));
    const canvas = screen.getByTestId('gradient-color-canvas');

    fireEvent.pointerDown(canvas, { clientX: 48, clientY: 96, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 32, pointerId: 1 });

    expect(screen.getByTestId('gradient-color-popover')).toBeInTheDocument();
    expect(screen.getByTestId('selected-color')).toHaveTextContent('#782080');
    expect(screen.getByTestId('color-picker-input')).toHaveValue('#782080');
  });

  it('closes only when clicking outside the whole component', async () => {
    render(<ControlledPicker />);

    fireEvent.click(screen.getByTestId('color-picker-trigger'));
    expect(screen.getByTestId('gradient-color-popover')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId('gradient-color-popover')).not.toBeInTheDocument();
    });
  });
});
