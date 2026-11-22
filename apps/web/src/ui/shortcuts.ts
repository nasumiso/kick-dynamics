// キーボードショートカット（反復操作の補助、表示層だけ）。対応するボタンを押したのと同じ動作にする。

export type ShortcutAction = 'kick' | 'reset' | 'pause' | 'replay' | 'behind';

/** 操作ごとのキー。表示（ボタンのキー表記・ツールチップ・一覧）にも使う。 */
export const SHORTCUT_KEYS: Readonly<Record<ShortcutAction, { readonly code: string; readonly label: string }>> = {
  kick: { code: 'KeyK', label: 'K' },
  reset: { code: 'KeyR', label: 'R' },
  pause: { code: 'Space', label: 'Space' },
  replay: { code: 'KeyP', label: 'P' },
  behind: { code: 'KeyV', label: 'V' },
};

export interface KeyLike {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly repeat: boolean;
  /** キー入力を受ける要素（入力欄・選択欄）にフォーカスがあるか */
  readonly inEditable: boolean;
}

/**
 * キー入力に対応する操作。修飾キー付き（⌘R の再読み込みなど）、押しっぱなしの繰り返し、
 * 入力欄・選択欄での入力は、ブラウザと入力欄の動作を妨げないよう対象にしない。
 */
export function shortcutAction(key: KeyLike): ShortcutAction | null {
  if (key.ctrlKey || key.metaKey || key.altKey || key.shiftKey || key.repeat || key.inEditable) return null;
  for (const [action, { code }] of Object.entries(SHORTCUT_KEYS) as Array<[ShortcutAction, { code: string }]>) {
    if (key.code === code) return action;
  }
  return null;
}

/** 文字を入力する要素か（スライダー・チェックボックスは、操作の後もショートカットが効くよう含めない）。 */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !['range', 'checkbox', 'radio', 'button'].includes(target.type);
  return target.isContentEditable || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

/** ショートカットを登録する（渡したボタンの操作だけを受け持つ。複数回に分けて登録してよい）。無効になっているボタンの操作は行わない。 */
export function installShortcuts(buttons: Readonly<Partial<Record<ShortcutAction, HTMLButtonElement>>>): void {
  document.addEventListener('keydown', (event) => {
    const action = shortcutAction({
      code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey,
      shiftKey: event.shiftKey, repeat: event.repeat, inEditable: isEditable(event.target),
    });
    if (action === null) return;
    const button = buttons[action];
    if (!button) return;
    // Space がフォーカス中のボタンを押したり、ページをスクロールしたりしないようにする。
    event.preventDefault();
    if (!button.disabled) button.click();
  });
}

/** キーの表記とツールチップ付きのボタン。文言を変えるときは text の中身を変える（キーの表記は残る）。 */
export function shortcutButton(text: string, action: ShortcutAction, testId: string): { button: HTMLButtonElement; text: HTMLSpanElement } {
  const { label } = SHORTCUT_KEYS[action];
  const caption = document.createElement('span');
  caption.textContent = text;
  const kbd = document.createElement('kbd');
  kbd.textContent = label;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = testId;
  button.title = `ショートカット：${label}`;
  button.append(caption, ' ', kbd);
  return { button, text: caption };
}

/** パネルに出すショートカットの一覧の文言。 */
export function shortcutSummary(): string {
  const k = SHORTCUT_KEYS;
  return `キーボード：${k.kick.label} キック、${k.reset.label} 初期位置に戻す、${k.pause.label} 一時停止／再開、${k.replay.label} リプレイ、${k.behind.label} 足の後ろから見る（数値の入力欄・選択欄にフォーカスがあるときは効きません）`;
}
