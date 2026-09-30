"use client";

import { Panel } from "@/components/ui/layout";
import { Bars, CxLegend, Distribution } from "@/components/ui/charts";
import { ErrorState, TableSkeleton } from "@/components/ui/states";
import { lastMonths } from "@/lib/format";

const n = (v) => (v ? v : <span className="zero">0</span>);

/**
 * Team comparison: output, load and risk per team for the selected period, plus completed work per
 * month for the last six months. All trend bars share one scale so teams compare directly.
 */
export default function TeamComparison({ teams, loading, error, onRetry, periodLabel }) {
  const months = lastMonths(6);
  const max = Math.max(1, ...teams.flatMap((t) => t.trend));
  return (
    <Panel
      title="Team comparison"
      meta={periodLabel}
      footer={<><CxLegend /><span style={{ marginLeft: "auto" }}>Monthly bars use one scale across teams · hover for values</span></>}
    >
      {loading ? <TableSkeleton rows={3} /> : error ? <ErrorState error={error} title="Couldn't load team figures" onRetry={onRetry} compact /> : (
        <div className="table-wrap">
          <table className="dt hover">
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col" className="r">People</th>
                <th scope="col" className="r">Completed</th>
                <th scope="col" className="r">Hours</th>
                <th scope="col" className="r">Active</th>
                <th scope="col" className="r">Overdue</th>
                <th scope="col" style={{ width: "22%" }}>Complexity of completed work</th>
                <th scope="col">Completed per month</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.team}>
                  <td className="title">{t.team}</td>
                  <td className="r">{n(t.people)}</td>
                  <td className="r strong">{n(t.completed)}</td>
                  <td className="r">{n(t.hours)}</td>
                  <td className="r">{n(t.active)}</td>
                  <td className="r">{t.overdue ? <span className="overdue">{t.overdue}</span> : <span className="zero">0</span>}</td>
                  <td>{t.complexity.some(Boolean) ? <Distribution parts={t.complexity} /> : <span className="muted">No completed work</span>}</td>
                  <td><Bars values={t.trend} labels={months} max={max} name={`${t.team}, completed tasks per month`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
