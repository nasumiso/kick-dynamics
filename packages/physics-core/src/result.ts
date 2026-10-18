// 想定内のエラーを例外ではなく値で返すための型（docs/04-architecture.md §6）。

export interface SimError {
  readonly code: SimErrorCode;
  readonly message: string;
}

export type SimErrorCode =
  | 'invalid-coefficient'
  | 'unsupported-model';

export type SimResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SimError };

export function ok<T>(value: T): SimResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: SimErrorCode, message: string): SimResult<T> {
  return { ok: false, error: { code, message } };
}
