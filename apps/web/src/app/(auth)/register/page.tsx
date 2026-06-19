import { RegisterForm } from '@/features/auth/register-form';
import { BrandBackdrop } from '@/components/brand-backdrop';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <BrandBackdrop />
      <RegisterForm />
    </main>
  );
}
