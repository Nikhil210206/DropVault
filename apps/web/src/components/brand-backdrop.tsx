/**
 * A single, static, low-intensity brand glow — used only on the "moment" pages
 * (auth, public share), never in the dense workspace. Restraint over decoration.
 */
export function BrandBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-[-10rem] h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
    </div>
  );
}
