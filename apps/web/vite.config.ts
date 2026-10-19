// KickDynamics Lab の Vite 設定（T1.4-01）。静的ビルドの成果物は dist/ に出力する（NFR-01、AC-17）。
import { defineConfig } from 'vite';

export default defineConfig({
  // 静的ファイルサーバーの任意のパスに置けるよう、相対パスで出力する。
  base: './',
  build: {
    // three を含む 1 つのチャンクが既定の警告の閾値（500 kB）を超える。分割は再生・計算の計測（M1.5、OQ-18）の後に検討する。
    chunkSizeWarningLimit: 1000,
  },
});
