// 表示単位への変換（AGENTS.md ルール 4：Core の入出力は SI。km/h・rpm・度は表示層だけで使う）。
// 換算係数は定義どおり：1 km/h = 1000/3600 m/s、1 rpm = 2π/60 rad/s、1° = π/180 rad。

export function msToKmh(speed: number): number {
  return (speed * 3600) / 1000;
}

export function kmhToMs(speed: number): number {
  return (speed * 1000) / 3600;
}

export function radPerSecToRpm(rate: number): number {
  return (rate * 60) / (2 * Math.PI);
}

export function rpmToRadPerSec(rate: number): number {
  return (rate * 2 * Math.PI) / 60;
}

export function radToDeg(angle: number): number {
  return (angle * 180) / Math.PI;
}

export function degToRad(angle: number): number {
  return (angle * Math.PI) / 180;
}
