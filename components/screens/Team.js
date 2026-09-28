"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { EmptyState, Status, Who } from "@/components/ui/indicators";
import { people } from "@/lib/data";

export function PeopleTable({ list }) {
  const router = useRouter();
  return (
    <table className="dt">
      <thead><tr><th>Name</th><th>Role</th><th>Primary team</th><th>Workload</th><th className="r">Open tasks</th><th>Shift today</th><th /></tr></thead>
      <tbody>
        {list.map((p) => (
          <tr key={p.id} onClick={() => router.push("/performance/employees")}>
            <td className="title"><Who id={p.id} /></td>
            <td>{p.role}</td>
            <td>{p.team}{p.assist && <span className="muted"> · assisting {p.assist}</span>}</td>
            <td>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span className="progress" style={{ width: 100 }}><span style={{ width: `${p.load}%`, ...(p.load > 90 ? { background: "var(--warning)" } : {}) }} /></span>
                <span className="num muted">{p.load}%</span>
              </span>
            </td>
            <td className="r num">{p.open}</td>
            <td>
              {p.shift === "missing" ? <span className="badge danger">Not started</span>
                : p.shift === "completed" ? <Status s="done" label="Completed" />
                : p.shift === "active" ? <Status s="progress" label="In progress" />
                : <span className="muted">—</span>}
            </td>
            <td className="r"><Link className="btn btn-ghost btn-sm" href="/performance/employees" onClick={(e) => e.stopPropagation()}>Performance</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TEAMS = ["All", "SOC", "Design & Automation", "Threat Intelligence"];

export default function Team() {
  const [team, setTeam] = useState("All");
  const [q, setQ] = useState("");
  const list = people
    .filter((p) => team === "All" || p.team.startsWith(team) || (team === "SOC" && p.assist?.startsWith("SOC")))
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Team</h1><p>{people.length} people · Security Department</p></div>
        <div className="actions">
          <div className="seg">{TEAMS.map((t) => <button key={t} className={t === team ? "on" : ""} onClick={() => setTeam(t)}>{t}</button>)}</div>
        </div>
      </div>
      <div className="toolbar">
        <div className="search"><Icon name="search" /><input className="input" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="chip"><Icon name="plus" />Role</button>
        <button className="chip"><Icon name="plus" />Shift status</button>
      </div>
      {list.length ? <PeopleTable list={list} /> : <EmptyState icon={<Icon name="team" />} title="No people match">Try a different name or team.</EmptyState>}
    </div>
  );
}
