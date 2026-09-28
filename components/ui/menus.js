import { CX, PRIO, STATUS } from "@/lib/format";
import { Complexity, Priority, Status, Who } from "@/components/ui/indicators";

export const statusItems = () => Object.keys(STATUS).map((s, i) => ({ value: s, label: <Status s={s} />, kbd: String(i + 1) }));
export const prioItems = () => Object.keys(PRIO).map((p, i) => ({ value: p, label: <Priority p={p} />, kbd: String(i + 1) }));
export const cxItems = () => CX.slice(1).map((_, i) => ({ value: i + 1, label: <Complexity c={i + 1} />, kbd: String(i + 1) }));
export const peopleItems = (people) => people.filter((p) => p.active !== false).map((p) => ({ value: p.id, label: <><Who id={p.id} /><span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>{p.team}</span></> }));
