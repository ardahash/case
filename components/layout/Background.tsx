export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-vault" />
      <div className="absolute left-1/2 top-[-10%] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[420px] w-[420px] rounded-full bg-accent/20 blur-[140px]" />
      <div className="absolute inset-0 grid-fade opacity-50" />
    </div>
  );
}

