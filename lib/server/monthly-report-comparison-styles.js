// Visual system for the self-contained, print-friendly comparison page.
export function monthlyComparisonStyles(font) {
  return `
    ${font ? `@font-face{font-family:ReportVazir;src:url(data:font/woff2;base64,${font}) format('woff2');font-style:normal;font-weight:100 900;font-display:swap}` : ""}
    :root{color-scheme:light;--ink:#19353e;--muted:#63787d;--paper:#fff;--surface:#f1f6f4;--line:#d9e6e3;--shift:#087c74;--task:#cd704a;--sand:#f4e6d6}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--surface);color:var(--ink);font:14px/1.8 ReportVazir,Tahoma,Arial,sans-serif}
    h1,h2,h3,h4,p{margin:0}h1,h2,h3,h4{line-height:1.4}a{color:inherit}summary{cursor:pointer}a:focus-visible,summary:focus-visible{outline:3px solid var(--task);outline-offset:3px}
    .wrap{width:min(1300px,calc(100% - 64px));margin:auto}
    .comparison-cover{position:relative;overflow:hidden;color:#eef9f6;background:linear-gradient(122deg,#10313a,#174850)}
    .comparison-cover:after{content:"";pointer-events:none;position:absolute;inset:0;opacity:.2;background-image:linear-gradient(to right,transparent calc(100% - 1px),#b6ded5 1px),linear-gradient(to bottom,transparent calc(100% - 1px),#b6ded5 1px);background-size:54px 54px;mask-image:linear-gradient(to left,#000,transparent 82%)}
    .cover-nav{position:relative;z-index:1;padding:23px 0;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff28;gap:20px}
    .brand{font:800 16px/1 Arial,sans-serif;letter-spacing:.15em;direction:ltr}.brand span{color:#8bd3c2}.brand small{display:block;color:#8cbbb6;font:10px/1.7 Arial,sans-serif;letter-spacing:.14em;margin-top:4px}
    .report-switch{display:flex;gap:6px;flex-wrap:wrap;border:1px solid #ffffff36;border-radius:999px;padding:4px;background:#ffffff0c;font-size:12px}
    .report-switch a,.report-switch span{padding:6px 15px;border-radius:999px;text-decoration:none}.report-switch a:hover{background:#ffffff20}.report-switch [aria-current="page"]{background:#e3f5f0;color:#214840;font-weight:800}
    .cover-body{position:relative;z-index:1;padding:48px 0 66px}.kicker{display:block;color:#8dbcb4;font-weight:800;font-size:11px;letter-spacing:.07em}
    .cover-body h1{font-size:clamp(28px,4vw,47px);font-weight:900;letter-spacing:-.02em;margin:7px 0 9px}.cover-body>p{color:#bdd8d2;font-size:14px}
    .cover-period{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-top:31px}.cover-period strong{font-size:20px}.cover-period span{color:#c3dcd8;font-size:12px;direction:ltr}
    .sample{display:inline-flex;margin-top:14px;border:1px solid #f6c68e78;border-radius:7px;padding:5px 10px;color:#fbe2ba;font-size:12px}
    .comparison-summary{position:relative;margin-top:-39px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 16px 35px #204c4812;overflow:hidden}
    .scope{display:flex;gap:10px;align-items:baseline;padding:13px 22px;background:#eaf3f0;border-bottom:1px solid var(--line)}.scope span{color:var(--muted);font-size:11px}.scope strong{font-size:12px}
    .summary-figures{display:grid;grid-template-columns:repeat(4,1fr)}.summary-figures>div{padding:17px 22px;min-width:0}.summary-figures>div+div{border-inline-start:1px solid var(--line)}
    .summary-figures span{display:block;color:var(--muted);font-size:11px}.summary-figures b{display:block;font-size:25px;font-weight:900;line-height:1.3;margin-top:7px;font-variant-numeric:tabular-nums}
    .summary-figures>div:nth-child(2) b{color:var(--shift)}.summary-figures>div:nth-child(3) b{color:var(--task)}
    .team-navigation{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 35px}.team-navigation a{text-decoration:none;background:#fff;border:1px solid var(--line);padding:7px 13px;border-radius:8px;font-weight:700;font-size:12px}.team-navigation a:hover{border-color:var(--shift);color:var(--shift)}
    .comparison-team{margin:0 0 55px;scroll-margin-top:24px}.team-head{display:flex;justify-content:space-between;align-items:end;gap:20px;padding-bottom:15px;border-bottom:2px solid #94b9b1}.team-head h2{font-size:24px;margin-top:4px}
    .team-count{border-radius:999px;padding:5px 11px;border:1px solid #c3ddd5;background:#e7f3ee;color:#237367;font-size:12px;white-space:nowrap}
    .comparison-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}
    .chart-panel{border:1px solid var(--line);background:var(--paper);border-radius:15px;padding:22px 21px 14px;box-shadow:0 7px 28px #1e4d4708;min-width:0}
    .chart-panel-head h3{font-size:18px}.chart-panel-head p{font-size:11px;color:var(--muted);margin-top:2px}
    .chart-legend{display:flex;gap:16px;flex-wrap:wrap;margin:17px 0;font-size:11px;color:#546b70}.chart-legend span:before{content:"";display:inline-block;width:9px;height:9px;border-radius:2px;margin-inline-end:6px}
    .legend-shift:before{background:var(--shift)}.legend-task:before{background:var(--task)}
    .chart-rows{display:grid;gap:12px}.chart-person{border-top:1px solid #edf1f0;padding-top:11px}.chart-person:first-child{border-top:0;padding-top:0}
    .person-key{display:block;font-size:12px;font-weight:800;line-height:1.5;overflow-wrap:anywhere;margin-bottom:5px}.track-pair{display:grid;gap:4px}
    .chart-track-row{display:grid;grid-template-columns:56px minmax(0,1fr) 37px;gap:8px;align-items:center}
    .track-label{display:block;color:var(--muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .track{height:10px;border-radius:3px;background:repeating-linear-gradient(90deg,#eaf0ee 0,#eaf0ee calc(25% - 1px),#d4e2de calc(25% - 1px),#d4e2de 25%);overflow:hidden;direction:ltr}
    .track-fill{display:block;height:100%;border-radius:3px;transform-origin:left center;animation:grow .85s ease-out both}.track-fill.shift{background:var(--shift)}.track-fill.task{background:var(--task)}
    .track-value{font:800 11px/1.4 ReportVazir,Tahoma,sans-serif;text-align:end;font-variant-numeric:tabular-nums}
    .chart-axis{display:flex;justify-content:space-between;color:#7e9294;font-size:10px;border-top:1px solid #edf2ef;margin-top:18px;padding-top:7px}
    .activity-heading{display:flex;gap:20px;align-items:baseline;justify-content:space-between;margin:27px 0 12px}.activity-heading h3{font-size:18px}.activity-heading p{color:var(--muted);font-size:11px}
    .activity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.activity-card{border:1px solid var(--line);background:#fff;border-radius:12px;padding:16px;min-width:0}
    .activity-identity{display:flex;align-items:center;gap:10px}.activity-initial{flex:none;width:37px;height:37px;border-radius:11px;background:var(--sand);color:#98603d;display:grid;place-items:center;font-size:17px;font-weight:900}
    .activity-identity h4{font-size:14px;overflow-wrap:anywhere}.activity-identity p{font-size:10px;color:var(--muted);margin-top:2px}
    .activity-tags{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.activity-tags span{border-radius:6px;padding:4px 7px;background:#eef4f2;color:#405e5a;font-size:10px}
    .task-list{border-top:1px solid var(--line);padding-top:10px}.task-list summary{font-size:12px;font-weight:700;color:#28685f}.task-list summary b{display:inline-block;border-radius:6px;background:#e0f1ec;padding:0 7px;margin-inline-start:5px}
    .task-list ul{margin:10px 0 0;padding-inline-start:20px}.task-list li{padding:5px 0;border-bottom:1px solid #edf3ef;font-size:12px;overflow-wrap:anywhere}.task-list li:last-child{border-bottom:0}.task-list li small{color:var(--muted);margin-inline-start:6px;white-space:nowrap}
    .empty{padding:8px 0;color:var(--muted);font-size:12px}.comparison-notes{background:#e5efec;border-inline-start:4px solid var(--shift);border-radius:9px;padding:15px 18px;margin:30px 0;color:#375c57}
    .comparison-notes strong{font-size:12px}.comparison-notes p{font-size:11px;line-height:2;margin-top:4px}.no-people{padding:40px 0;color:var(--muted);text-align:center}
    footer{border-top:1px solid #d5e3df;padding:18px 0 30px;color:var(--muted);font-size:10px}
    @keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @media(max-width:1000px){.comparison-grid{grid-template-columns:1fr}.chart-panel{padding:20px}.chart-track-row{grid-template-columns:88px minmax(0,1fr) 42px}}
    @media(max-width:700px){.wrap{width:calc(100% - 30px)}.cover-nav{align-items:flex-start;flex-direction:column;gap:12px}.cover-body{padding:32px 0 61px}.summary-figures{grid-template-columns:repeat(2,1fr)}.summary-figures>div:nth-child(3){border-inline-start:0;border-top:1px solid var(--line)}.summary-figures>div:nth-child(4){border-top:1px solid var(--line)}.activity-grid{grid-template-columns:1fr}.team-head h2{font-size:21px}.cover-period{gap:6px}.chart-track-row{grid-template-columns:56px minmax(0,1fr) 38px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.track-fill{animation:none}}
    @media print{body{background:#fff}.comparison-cover{color:#17343c;background:#fff;border-bottom:2px solid #087c74}.comparison-cover:after,.report-switch,.team-navigation{display:none}.cover-body>p,.cover-period span,.brand small,.kicker{color:#63787d}.comparison-summary,.chart-panel,.activity-card{box-shadow:none;break-inside:avoid}.comparison-summary{margin-top:0}.track-fill{animation:none;print-color-adjust:exact}.comparison-team{break-before:auto}.activity-card{break-inside:avoid}}
  `;
}
