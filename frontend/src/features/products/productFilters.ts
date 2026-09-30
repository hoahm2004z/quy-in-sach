import type { ProductFilterKey } from '@/types/public';

export function filterToQuery(filter: ProductFilterKey): {
  type?: 'BOOK' | 'SPEAKER';
  status?: 'UPCOMING' | 'PRINTED';
} {
  switch (filter) {
    case 'BOOK_UPCOMING':
      return { type: 'BOOK', status: 'UPCOMING' };
    case 'BOOK_PRINTED':
      return { type: 'BOOK', status: 'PRINTED' };
    case 'SPEAKER':
      return { type: 'SPEAKER' };
    default:
      return {};
  }
}
