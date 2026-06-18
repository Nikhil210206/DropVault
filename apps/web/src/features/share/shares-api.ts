import type { CreateShareInput, PublicShare } from '@dropvault/shared';
import { api } from '@/lib/api-client';

export const sharesApi = {
  create: (input: CreateShareInput) => api.post<{ share: PublicShare }>('/shares', input),
};
