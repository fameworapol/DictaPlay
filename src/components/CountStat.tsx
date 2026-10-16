export function CountStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-100 p-2 text-center">
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  )
}
