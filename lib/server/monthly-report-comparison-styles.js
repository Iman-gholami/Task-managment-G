// A self-contained management dossier: calm surfaces, one operational signal, two legible data series.
export function monthlyComparisonStyles(font) {
  return `
    ${font ? `@font-face{font-family:ReportVazir;src:url(data:font/woff2;base64,${font}) format('woff2');font-style:normal;font-weight:100 900;font-display:swap}` : ""}
    :root{color-scheme:light;--ink:#192c37;--muted:#596f7b;--subtle:#83949d;--paper:#fff;--canvas:#f0f5f6;--line:#dbe5e9;--navy:#102d39;--shift:#07897d;--task:#386acb;--warning:#a85e22;--brand:#62d6c6}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font:14px/1.75 ReportVazir,Tahoma,Arial,sans-serif}
    h1,h2,h3,h4,p{margin:0}h1,h2,h3,h4{line-height:1.4}a{color:inherit}summary{cursor:pointer}
    a:focus-visible,summary:focus-visible{outline:3px solid var(--shift);outline-offset:4px;border-radius:3px}
    ::selection{background:#bbeee7;color:#153842}.wrap{width:min(1320px,calc(100% - 72px));margin:auto}
    .comparison-cover{color:#f2faf9;background:var(--navy);position:relative;overflow:hidden}
    .comparison-cover:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(650px 370px at 86% 10%,#2c667047,transparent 73%),linear-gradient(90deg,transparent 60%,#ffffff03 60%);background-size:auto,20px 20px}
    .comparison-cover:after{content:"";position:absolute;inset-block:90px 0;inset-inline-end:0;width:21%;opacity:.23;pointer-events:none;background:repeating-linear-gradient(125deg,transparent 0 22px,#84d6c7 22px 23px,transparent 23px 45px);mask-image:linear-gradient(to left,#000,transparent)}
    .comparison-cover>.wrap{position:relative;z-index:1}
    .cover-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:23px 0;border-bottom:1px solid #ffffff24}
    .brand{display:flex;align-items:center;gap:11px;direction:ltr}
    .brand-symbol{display:grid;place-items:center;width:43px;height:43px;position:relative;border:1px solid #69dac59c;border-radius:9px;background:#69dac515;font:900 27px/1 Arial,sans-serif;color:var(--brand);letter-spacing:-.12em}
    .brand-dot{position:absolute;width:5px;height:5px;border-radius:50%;background:#80f3db;bottom:7px;right:6px;box-shadow:0 0 8px #80f3db}
    .brand strong{display:block;font:800 17px/1.2 Arial,sans-serif;letter-spacing:.13em}.brand strong span{color:var(--brand)}
    .brand small{display:block;color:#83aaaf;font:9px/1.7 Arial,sans-serif;letter-spacing:.11em;margin-top:5px}
    .report-switch{display:flex;align-items:center;gap:5px;border:1px solid #537780;background:#ffffff0a;padding:4px;border-radius:8px;font-size:12px}
    .report-switch a,.report-switch span{display:block;padding:6px 12px;text-decoration:none;border-radius:5px}
    .report-switch a:hover{color:#fff;background:#ffffff16}.report-switch [aria-current="page"]{color:#173c43;background:#c6f2e9;font-weight:800}
    .cover-body{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(225px,.65fr);align-items:end;gap:50px;padding:65px 0 63px}
    .section-eyebrow{display:block;color:var(--shift);font-size:10px;font-weight:850;letter-spacing:.04em}
    .cover-intro>.section-eyebrow{color:#78d8c9}
    .cover-intro h1{font-size:clamp(30px,3.4vw,49px);font-weight:900;letter-spacing:-.028em;margin:10px 0 13px;line-height:1.35}
    .title-accent{color:var(--brand);font:inherit;margin-inline-start:1px}.cover-intro>p{color:#b6d1d4;max-width:57ch;font-size:14px}
    .cover-period{padding-inline-start:28px;border-inline-start:1px solid #6a939976;min-height:120px}
    .cover-period>span{display:block;color:#8cb6bb;font-size:11px}.cover-period strong{display:block;font-size:clamp(22px,2.3vw,30px);font-weight:900;line-height:1.5;margin-top:6px}
    .cover-period small{display:block;color:#b5d0d1;font-size:12px;text-align:start;direction:ltr;margin-top:5px;white-space:nowrap}
    .cover-period em{display:inline-block;color:#a5f2d9;font-style:normal;font-size:11px;margin-top:8px}
    .sample{display:inline-block;margin-top:17px;padding:5px 10px;border:1px solid #e6bb7a81;color:#ffe2ad;background:#e0a85714;border-radius:5px;font-size:11px}
    .comparison-summary{display:grid;grid-template-columns:190px minmax(0,1fr);gap:20px;align-items:stretch;border-top:1px solid #ffffff29;padding:22px 0 31px}
    .scope{display:flex;flex-direction:column;justify-content:center;gap:3px;padding-inline-end:20px;border-inline-end:1px solid #ffffff29;min-width:0}
    .scope span{font-size:10px;color:#91b4b8}.scope strong{font-size:12px;line-height:1.8;overflow-wrap:anywhere}
    .summary-figures{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}
    .summary-figures>div{min-width:0;position:relative;padding-inline-start:18px}
    .summary-figures>div:before{content:"";position:absolute;inset-inline-start:0;top:9px;width:2px;height:32px;background:#42636b}
    .summary-figures>div:nth-child(2):before{background:var(--brand)}.summary-figures>div:nth-child(3):before{background:#91b3ff}
    .summary-figures span{display:block;font-size:10px;color:#a6c3c6;min-height:28px;line-height:1.5}
    .summary-figures b{display:inline-block;font-size:clamp(22px,2.4vw,31px);font-weight:850;line-height:1.1;font-variant-numeric:tabular-nums;margin-top:4px}
    .summary-figures small{font-size:10px;color:#87a8b0;margin-inline-start:7px}
    .team-navigation{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:23px 0 36px}
    .team-navigation>span{font-size:11px;font-weight:700;color:var(--muted);margin-inline-end:9px}
    .team-navigation a{font-size:12px;font-weight:700;padding:7px 13px;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:5px;transition:color .16s ease,border-color .16s ease,background .16s ease}
    .team-navigation a:hover{color:var(--shift);border-color:#6dc3bb;background:#e5f4f0}
    .comparison-team{margin-bottom:64px;scroll-margin-top:20px}
    .team-head{display:flex;align-items:end;justify-content:space-between;gap:22px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #b8cdd1}
    .team-heading{display:flex;align-items:center;gap:17px;min-width:0}
    .team-index{font:900 40px/1 Arial,sans-serif;letter-spacing:-.07em;color:#b8d1d5;direction:ltr}
    .team-head h2{font-size:clamp(21px,2vw,27px);font-weight:850;line-height:1.3;margin-top:4px}
    .team-head p{font-size:11px;color:var(--muted);margin-top:4px}
    .team-rollup{display:flex;flex-wrap:wrap;justify-content:end;gap:9px}
    .team-rollup span{display:flex;align-items:baseline;gap:7px;color:var(--muted);background:#fff;border:1px solid var(--line);border-radius:6px;padding:8px 12px;font-size:10px}
    .team-rollup b{font-size:16px;font-weight:850;color:var(--ink);font-variant-numeric:tabular-nums}
    .team-rollup span:first-child b{color:var(--shift)}.team-rollup span:nth-child(2) b{color:var(--task)}
    .comparison-grid{display:grid;gap:14px}
    .chart-panel{background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 7px 25px #14394909}
    .chart-panel-head{display:flex;align-items:center;justify-content:space-between;gap:28px;padding:21px 24px 19px;border-bottom:1px solid var(--line)}
    .chart-panel-head h3{font-size:19px;font-weight:850;margin:3px 0}.chart-panel-head p{color:var(--muted);font-size:11px}
    .chart-legend{display:flex;gap:15px;flex-wrap:wrap;max-width:50%;font-size:11px;color:var(--muted)}
    .chart-legend span{display:flex;align-items:center;gap:6px}
    .chart-legend span:before{content:"";width:9px;height:9px;display:inline-block;border-radius:2px;flex:none}
    .legend-shift:before{background:var(--shift)}.legend-task:before{background:var(--task)}
    .chart-rows{padding:2px 24px 0}
    .chart-person{display:grid;grid-template-columns:225px minmax(0,1fr);align-items:center;gap:28px;padding:13px 0;border-bottom:1px solid #eaf0f2}
    .chart-person:last-child{border-bottom:none}
    .chart-person-name{display:flex;align-items:center;gap:10px;min-width:0}
    .person-mark{display:grid;place-items:center;width:31px;height:31px;flex:none;border-radius:7px;background:#e9f0f2;color:#47606b;font-size:14px;font-weight:800}
    .chart-person-name strong{display:block;font-size:12px;font-weight:850;line-height:1.5;overflow-wrap:anywhere}
    .chart-person-name small{display:block;color:var(--subtle);font-size:10px;overflow-wrap:anywhere}
    .chart-lanes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:29px;min-width:0}
    .lane-label{display:flex;align-items:baseline;justify-content:space-between;gap:9px;margin-bottom:7px}
    .lane-label span{color:var(--muted);font-size:10px}.lane-label strong{font-size:12px;font-weight:900;line-height:1.2;font-variant-numeric:tabular-nums}
    .data-track{position:relative;overflow:hidden;width:100%;height:13px;border-radius:3px;background:repeating-linear-gradient(to right,#eff3f5 0,#eff3f5 calc(25% - 1px),#dde8eb calc(25% - 1px),#dde8eb 25%);direction:ltr}
    .data-fill{display:block;height:100%;border-radius:3px;transform-origin:left center;animation:grow .65s ease-out both}
    .data-fill.shift{background:linear-gradient(90deg,#127568,#1ca895)}
    .data-fill.task{background:linear-gradient(90deg,#315bb1,#6997f1)}
    .chart-axis{display:flex;justify-content:space-between;gap:14px;padding:10px 24px;background:#f8fafb;border-top:1px solid var(--line);font-size:10px;color:var(--subtle)}
    .activity-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:29px 0 13px}
    .activity-heading h3{font-size:20px;margin-top:3px}.activity-heading>p{font-size:11px;color:var(--muted)}
    .activity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
    .activity-card{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;min-width:0;box-shadow:0 7px 23px #14394908}
    .activity-identity{display:flex;align-items:center;gap:12px;padding:20px 20px 17px}
    .activity-initial{display:grid;place-items:center;flex:none;width:45px;height:45px;border-radius:10px;background:linear-gradient(140deg,#e5f2f2,#dae9f0);border:1px solid #d0e4e5;color:#18796f;font-size:20px;font-weight:850}
    .activity-identity h4{font-size:15px;font-weight:850;overflow-wrap:anywhere}
    .activity-identity p{font-size:11px;color:var(--muted);margin-top:2px}
    .outcome-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 20px 17px;background:#f5f8f9;border:1px solid #e5edef;border-radius:8px;overflow:hidden}
    .outcome-grid>div{min-width:0;padding:13px 11px;position:relative}
    .outcome-grid>div+div{border-inline-start:1px solid #e3ebec}
    .outcome-grid strong{display:block;font-size:22px;line-height:1.35;font-weight:850;font-variant-numeric:tabular-nums}
    .outcome-grid span{display:block;color:var(--muted);font-size:10px;line-height:1.65;margin-top:3px}
    .outcome-grid .outcome-main strong{color:var(--shift)}
    .log-coverage{display:flex;align-items:center;gap:15px;padding:4px 20px 15px}
    .log-ring{width:61px;height:61px;border-radius:50%;display:grid;place-items:center;flex:none;position:relative;background:conic-gradient(var(--shift) var(--progress),#e5edf0 0);direction:ltr}
    .log-ring:before{content:"";position:absolute;inset:7px;border-radius:50%;background:#fff}
    .log-ring span{position:relative;z-index:1;font-size:12px;font-weight:850;color:var(--ink)}
    .log-coverage>div:last-child{min-width:0}.log-coverage strong{font-size:11px}.log-coverage p{font-size:10px;color:var(--muted)}
    .log-coverage p b{font-weight:850}.log-coverage .pending{color:var(--warning)}
    .ticket-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 20px 16px;font-size:11px;color:var(--muted)}
    .ticket-strip span{display:inline-flex;align-items:center;gap:5px;border-radius:5px;background:#edf3f9;border:1px solid #dce8f4;padding:3px 8px}
    .ticket-strip b{font-weight:850;color:var(--task)}
    .task-list{border-top:1px solid var(--line);background:#fff}
    .task-list>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;font-size:12px;font-weight:800;list-style:none;color:#176c63;transition:background .16s ease}
    .task-list>summary::-webkit-details-marker{display:none}.task-list>summary:hover{background:#f2f9f7}
    .task-list summary b{padding:1px 7px;margin-inline-start:4px;color:#176c63;background:#e1f3ed;border-radius:5px}
    .chevron{display:inline-block;width:8px;height:8px;border-inline-end:2px solid var(--shift);border-bottom:2px solid var(--shift);transform:rotate(45deg);transition:transform .2s ease;margin-inline-end:5px}
    .task-list[open] .chevron{transform:rotate(225deg)}
    .task-list-head{padding:8px 20px;font-size:10px;color:var(--muted);background:#f8fafb;border-top:1px solid var(--line)}
    .task-list ul{list-style:none;padding:3px 20px 10px;margin:0;background:#f8fafb}
    .task-list li{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #e4eced;font-size:11px}
    .task-list li:last-child{border-bottom:0}.task-label{min-width:0;overflow-wrap:anywhere}
    .task-list li small{color:var(--muted);white-space:nowrap;font-size:10px}
    .empty{padding:14px 20px;color:var(--muted);font-size:12px}
    .comparison-notes{display:flex;gap:13px;background:#e4eff0;border:1px solid #d1e3e3;border-radius:8px;padding:17px 20px;margin:25px 0 36px}
    .note-symbol{display:grid;place-items:center;width:24px;height:24px;border:1px solid #97c8c7;border-radius:50%;color:#16796c;font:italic 700 15px/1 Georgia,serif;flex:none}
    .comparison-notes strong{font-size:11px}.comparison-notes p{font-size:11px;line-height:2.1;color:#4f6b72;margin-top:4px}
    .no-people{text-align:center;background:#fff;border:1px solid var(--line);border-radius:8px;padding:42px;color:var(--muted)}
    footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;border-top:1px solid #d0dfe1;padding:18px 0 34px;color:#7a929c;font:10px/1.7 ReportVazir,Tahoma,Arial,sans-serif}
    footer span:first-child{font:700 10px/1.6 Arial,sans-serif;letter-spacing:.05em;direction:ltr}
    @keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @media(max-width:1030px){.comparison-summary{grid-template-columns:145px minmax(0,1fr)}.summary-figures{gap:12px}.chart-person{grid-template-columns:165px minmax(0,1fr);gap:18px}.chart-lanes{gap:16px}.team-head{align-items:start;flex-direction:column}.team-rollup{justify-content:start}}
    @media(max-width:730px){.wrap{width:calc(100% - 32px)}.cover-nav{align-items:flex-start;gap:14px;flex-direction:column}.brand small{font-size:8px}.cover-body{grid-template-columns:1fr;gap:28px;padding:40px 0 32px}.cover-period{border-inline-start:0;border-top:1px solid #6a939976;padding:12px 0 0;min-height:0}.cover-period strong{font-size:25px}.comparison-summary{grid-template-columns:1fr;gap:14px}.scope{border-inline-end:0;padding:0}.summary-figures{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.summary-figures>div{padding-inline-start:12px}.chart-panel-head{flex-direction:column;align-items:start;gap:10px}.chart-legend{max-width:none}.chart-person{grid-template-columns:1fr;gap:12px}.chart-lanes{grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.activity-grid{grid-template-columns:1fr}.activity-heading{align-items:start;flex-direction:column;gap:4px}.team-rollup{gap:6px}.team-rollup span{flex-grow:1}.summary-figures span{min-height:0}}
    @media(max-width:415px){.chart-lanes{grid-template-columns:1fr;gap:9px}.chart-person{gap:10px}.chart-rows,.chart-panel-head{padding-inline:15px}.chart-axis{padding-inline:15px}.outcome-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.outcome-grid>div:nth-child(3){border-inline-start:0;border-top:1px solid #e3ebec}.outcome-grid>div:nth-child(4){border-top:1px solid #e3ebec}.team-heading{gap:10px}.team-index{font-size:30px}.team-head h2{font-size:20px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.data-fill{animation:none}.chevron,.team-navigation a{transition:none}}
    @media print{body{background:#fff}.wrap{width:100%}.comparison-cover{background:#fff;color:var(--ink);border-bottom:2px solid var(--shift)}.comparison-cover:before,.comparison-cover:after,.report-switch,.team-navigation{display:none}.brand,.cover-intro>.section-eyebrow,.cover-intro>p,.cover-period>span,.cover-period small,.scope span,.summary-figures span{color:var(--muted)}.brand strong span,.title-accent{color:var(--shift)}.comparison-summary{border-top:1px solid var(--line)}.scope{border-color:var(--line)}.chart-panel,.activity-card{box-shadow:none;break-inside:avoid}.data-fill{animation:none;print-color-adjust:exact}.log-ring{print-color-adjust:exact}.comparison-team{break-before:auto}.task-list:not([open])>*:not(summary){display:block}.task-list li{break-inside:avoid}.team-head{break-after:avoid}footer{padding-bottom:0}}
  `;
}
