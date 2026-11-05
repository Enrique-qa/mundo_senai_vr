export interface SavedPoint { id: string; position: [number, number, number] }
const key = 'senai-xray.positions.v1';

export function loadPositions(): SavedPoint[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (Array.isArray(saved) && saved.every(point =>
      typeof point?.id === 'string' && Array.isArray(point.position) &&
      point.position.length === 3 && point.position.every(Number.isFinite))) return saved;
  } catch { /* The administrator can position again when storage is unavailable. */ }
  return [];
}

export function savePositions(points: SavedPoint[]) {
  localStorage.setItem(key, JSON.stringify(points));
}
