'use client';

import { useParams } from 'next/navigation';
import { PublicShare } from '@/features/share/public-share';

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  return <PublicShare token={token} />;
}
