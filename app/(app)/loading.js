import { TableSkeleton } from "@/components/screens/Misc";

export default function Loading() {
  return (
    <div className="page" aria-busy="true">
      <div className="sk" style={{ width: 220, height: 24, marginBottom: 28 }} />
      <TableSkeleton rows={8} />
    </div>
  );
}
