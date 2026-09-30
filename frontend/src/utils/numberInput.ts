/**
 * Draft text for integer inputs.
 * - Cho phép chuỗi rỗng (để xóa hết / xóa số 0 rồi gõ lại).
 * - Bỏ số 0 đầu: "0125" → "125".
 * - "0" giữ nguyên cho đến khi user xóa hết.
 */
export function sanitizeIntDraft(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  return digits.replace(/^0+(?=\d)/, '');
}

/** Convert draft → number khi lưu API. Rỗng = 0. */
export function intDraftToNumber(draft: string): number {
  if (draft.trim() === '') return 0;
  const n = Number.parseInt(draft, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function numberToIntDraft(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(Math.trunc(Math.max(0, value)));
}
