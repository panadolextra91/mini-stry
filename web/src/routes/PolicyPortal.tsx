export function PolicyPortal() {
  return (
    <div className="p-8 flex flex-col gap-6">
      <h1 className="text-[28px] font-semibold leading-[60px]">Policy Portal</h1>
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] border border-dashed border-border rounded-lg bg-card/50">
        <p className="text-muted-foreground text-center">No active policies found</p>
      </div>
    </div>
  );
}
