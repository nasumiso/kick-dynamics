// 3D ビュー内の短い文字ラベル（常にカメラの方を向くスプライト）。表示専用。
import * as THREE from 'three';

/**
 * 高さ heightM（m）の文字ラベル。他の物体に隠れないよう、深度判定をせず最後に描く。
 * accent を与えると、ラベルの左端にその色の帯を付ける（対応する面の色を示すため）。
 */
export function createTextLabel(text: string, heightM: number, accent?: number): THREE.Sprite {
  const fontPx = 48;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available');
  const font = `bold ${fontPx}px system-ui, sans-serif`;
  context.font = font;
  const band = accent === undefined ? 0 : 18;
  canvas.width = Math.ceil(context.measureText(text).width) + 24 + band;
  canvas.height = fontPx + 20;
  context.font = font; // canvas の大きさを変えると設定が戻るため再設定する
  context.fillStyle = 'rgba(0, 0, 0, 0.55)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (accent !== undefined) {
    context.fillStyle = `#${accent.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, band, canvas.height);
  }
  context.fillStyle = '#ffffff';
  context.textBaseline = 'middle';
  context.fillText(text, 12 + band, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set((heightM * canvas.width) / canvas.height, heightM, 1);
  sprite.renderOrder = 10;
  return sprite;
}
