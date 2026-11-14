// キーボードショートカット（表示層）：対応するキーと、ブラウザ・入力欄の操作を妨げない条件。
import { describe, expect, it } from 'vitest';
import { shortcutAction, type KeyLike } from '../../src/ui/shortcuts';

const plain: KeyLike = { code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, inEditable: false };

describe('keyboard shortcuts', () => {
  it('maps K, R, Space and P to kick, reset, pause and replay', () => {
    expect(['KeyK', 'KeyR', 'Space', 'KeyP', 'KeyX'].map((code) => shortcutAction({ ...plain, code })))
      .toEqual(['kick', 'reset', 'pause', 'replay', null]);
  });

  it('ignores modified keys, key repeat and typing in an input', () => {
    for (const change of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { repeat: true }, { inEditable: true }]) {
      expect(shortcutAction({ ...plain, code: 'KeyR', ...change })).toBeNull();
    }
  });
});
