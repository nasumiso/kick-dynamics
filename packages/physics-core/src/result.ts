// 想定内のエラーを例外ではなく値で返すための型（docs/04-architecture.md §6）。

export interface SimError {
  readonly code: SimErrorCode;
  readonly message: string;
  /** 診断値（例：解けない衝突の u⁻、K、固着解 J*、05 §6.8） */
  readonly details?: Readonly<Record<string, unknown>>;
}

export type SimErrorCode =
  | 'invalid-coefficient'
  | 'invalid-parameter'
  | 'invalid-setting'
  | 'impact-unsolvable'
  | 'unsupported-model';

export type SimResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SimError };

export function ok<T>(value: T): SimResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: SimErrorCode, message: string, details?: Readonly<Record<string, unknown>>): SimResult<T> {
  return { ok: false, error: details === undefined ? { code, message } : { code, message, details } };
}
