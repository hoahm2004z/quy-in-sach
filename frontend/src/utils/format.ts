export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function productTypeLabel(type: string): string {
  if (type === 'BOOK') return 'Sách';
  if (type === 'SPEAKER') return 'Loa pháp thoại';
  return type;
}

export function productStatusLabel(type: string, status: string): string {
  if (status === 'ARCHIVED') return 'Đã lưu trữ';
  if (type === 'BOOK' && status === 'UPCOMING') return 'Sách sắp in';
  if (type === 'BOOK' && status === 'PRINTED') return 'Sách đã in';
  if (type === 'SPEAKER' && status === 'UPCOMING') return 'Loa sắp triển khai';
  if (type === 'SPEAKER') return 'Loa pháp thoại';
  return status;
}

/** Trạng thái giao dịch thu/chi */
export function transactionStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Chờ xác nhận';
    case 'CONFIRMED':
      return 'Đã xác nhận';
    case 'VOIDED':
      return 'Đã hủy';
    default:
      return status;
  }
}

/** Hành động nhật ký audit */
export function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE: 'Tạo mới',
    UPDATE: 'Cập nhật',
    ARCHIVE: 'Lưu trữ',
    SOFT_DELETE: 'Xóa mềm',
    RESTORE: 'Khôi phục',
    CONFIRM: 'Xác nhận',
    VOID: 'Hủy giao dịch',
    SEED: 'Khởi tạo dữ liệu mẫu',
  };
  return map[action] ?? action;
}

/** Tên thực thể trong nhật ký / thùng rác */
export function entityLabel(entity: string): string {
  const map: Record<string, string> = {
    product: 'Sách / Loa',
    donation: 'Khoản thu',
    expense: 'Khoản chi',
    companion: 'Người đồng hành',
    system: 'Hệ thống',
  };
  return map[entity] ?? entity;
}
