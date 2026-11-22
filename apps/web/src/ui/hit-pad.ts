// 打点パッド（spec 003 §4）：カメラの水平の向きからボールを水平に見た円の上で、打点 (a, b)（中心からのずれ / 半径）を選ぶ。
// 今の足の移動方向では選べない部分を、画素ごとに判定して灰色にする。範囲への寄せは呼び出し側で行う。
// 接触点がボールの裏側（カメラから見えない側）にあるときは、投影した位置を白抜きで示す。
// 回転量は表示しない（回転は Core の計算の結果としてだけ示す）。
import { element, formatNumber } from './dom';

const SVG = 'http://www.w3.org/2000/svg';
/** 表示上のボールの半径（SVG の座標）。 */
const DISK = 100;
const KEY_STEP = 0.02;
const FINE_KEY_STEP = 0.005;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

/** 灰色の部分の画像の解像度 px（表示の値）。 */
const MASK_SIZE = 96;

/** (a, b) を選べるか。 */
export type Selectable = (a: number, b: number) => boolean;

export interface HitPad {
  readonly root: HTMLElement;
  /** 打点の表示。enabled = false の間（再生中など）は操作を受け付けない */
  readonly show: (hit: readonly [number, number], front: boolean, enabled: boolean, selectable: Selectable) => void;
}

/** radius はボールの半径 m（ずれの mm の表示に使う）。 */
export function createHitPad(radius: number, onInput: (hit: readonly [number, number]) => void): HitPad {
  const canvas = svg('svg', { viewBox: `${-DISK - 10} ${-DISK - 10} ${2 * DISK + 20} ${2 * DISK + 20}`, tabindex: 0, role: 'slider', 'aria-label': '打点（矢印キーで動かす、Shift で細かく）', 'data-testid': 'hit-pad' });
  const gradient = svg('radialGradient', { id: 'hit-pad-shade', cx: 0.38, cy: 0.35, r: 0.75 });
  gradient.append(svg('stop', { offset: 0, 'stop-color': '#ffffff' }), svg('stop', { offset: 1, 'stop-color': '#9aa3ad' }));
  const defs = svg('defs', {});
  defs.append(gradient);
  const outside = svg('image', { x: -DISK, y: -DISK, width: 2 * DISK, height: 2 * DISK, preserveAspectRatio: 'none' });
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = MASK_SIZE;
  maskCanvas.height = MASK_SIZE;
  const line = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, class: 'hit-line' });
  const dot = svg('circle', { r: 8, class: 'hit-dot' });
  canvas.append(
    defs,
    svg('circle', { r: DISK, fill: 'url(#hit-pad-shade)' }),
    outside,
    svg('line', { x1: -DISK, y1: 0, x2: DISK, y2: 0, class: 'hit-axis' }),
    svg('line', { x1: 0, y1: -DISK, x2: 0, y2: DISK, class: 'hit-axis' }),
    svg('circle', { r: 3, class: 'hit-center' }),
    line,
    dot,
  );
  const readout = element('div', { class: 'pad-readout', 'data-testid': 'hit-readout' });
  const root = element('div', { class: 'overlay-pad', 'data-testid': 'hit-pad-panel' },
    element('div', { class: 'pad-title' }, '打点'),
    element('div', { class: 'pad-sub' }, 'カメラの向き（水平）からボールを見た図。灰色は今の足の向きでは選べない。V で足の後ろから'),
    canvas as unknown as Node,
    readout,
  );

  let current: readonly [number, number] = [0, 0];
  let enabled = true;
  let dragging = false;

  const fromPointer = (event: PointerEvent): void => {
    const matrix = canvas.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onInput([p.x / DISK, -p.y / DISK]);
  };
  canvas.addEventListener('pointerdown', (event) => {
    if (!enabled || event.button !== 0) return;
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
    fromPointer(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (dragging && enabled) fromPointer(event);
  });
  const stop = (): void => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('keydown', (event) => {
    if (!enabled) return;
    const s = event.shiftKey ? FINE_KEY_STEP : KEY_STEP;
    const step = ({ ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] } as Record<string, [number, number]>)[event.key];
    if (!step) return;
    event.preventDefault();
    if (Number.isNaN(current[0])) return; // 接触点が裏側のときは矢印キーで動かさない（クリックで選ぶ）
    onInput([current[0] + step[0], current[1] + step[1]]);
  });

  const paintMask = (selectable: Selectable): void => {
    const context = maskCanvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(MASK_SIZE, MASK_SIZE);
    for (let y = 0; y < MASK_SIZE; y++) {
      for (let x = 0; x < MASK_SIZE; x++) {
        const a = ((x + 0.5) / MASK_SIZE) * 2 - 1;
        const b = 1 - ((y + 0.5) / MASK_SIZE) * 2;
        if (Math.hypot(a, b) > 1 || selectable(a, b)) continue;
        const k = (y * MASK_SIZE + x) * 4;
        image.data.set([60, 68, 77, 150], k);
      }
    }
    context.putImageData(image, 0, 0);
    outside.setAttribute('href', maskCanvas.toDataURL());
  };

  const show = (hit: readonly [number, number], front: boolean, isEnabled: boolean, selectable: Selectable): void => {
    current = front ? hit : [Number.NaN, Number.NaN];
    paintMask(selectable);
    dot.classList.toggle('hidden-side', !front);
    root.classList.toggle('disabled', !isEnabled);
    const x = hit[0] * DISK;
    const y = -hit[1] * DISK;
    dot.setAttribute('cx', String(x));
    dot.setAttribute('cy', String(y));
    line.setAttribute('x2', String(x));
    line.setAttribute('y2', String(y));
    // mm に丸めてから向きを決める（−0.0… を「左 0 mm」としない）
    const right = Math.round(hit[0] * radius * 1000) + 0;
    const up = Math.round(hit[1] * radius * 1000) + 0;
    readout.textContent = `${front ? '' : '裏側：'}中心から ${right >= 0 ? '右' : '左'} ${formatNumber(Math.abs(right), 0)} mm・${up >= 0 ? '上' : '下'} ${formatNumber(Math.abs(up), 0)} mm`;
  };
  return { root, show };
}

/** 3D ビューの上に短く出す知らせ。 */
export function createNotice(): { readonly root: HTMLElement; readonly show: (message: string) => void } {
  const root = element('div', { class: 'overlay-notice', 'data-testid': 'viewport-notice' });
  root.hidden = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    root,
    show: (message) => {
      root.textContent = message;
      root.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { root.hidden = true; }, 3000);
    },
  };
}
