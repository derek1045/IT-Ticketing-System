export default function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-3 h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-2 h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-4 h-4 w-1/4 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
