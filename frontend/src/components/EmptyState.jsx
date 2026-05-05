export default function EmptyState({ title, message }) {
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 text-4xl">🎫</div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
