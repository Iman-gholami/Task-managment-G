// Mock data for the prototype. Shapes mirror the intended API.
window.DB = (() => {
  const people = [
    { id: "sr", name: "Sara Rahimi", role: "Analyst", team: "SOC · L1", color: "#5B6CF0", load: 72, open: 5, shift: "active" },
    { id: "am", name: "Arash Moradi", role: "Analyst", team: "SOC · L2", color: "#2F9E79", load: 88, open: 7, shift: "completed" },
    { id: "nk", name: "Neda Karimi", role: "Analyst", team: "SOC · L1", color: "#C0703A", load: 41, open: 3, shift: "missing" },
    { id: "rj", name: "Reza Jafari", role: "Analyst", team: "SOC · L3", color: "#8A5BD6", load: 64, open: 4, shift: "active" },
    { id: "ms", name: "Mina Sadeghi", role: "Engineer", team: "Design & Automation", color: "#3A8FC4", load: 95, open: 8, shift: null, assist: "SOC · L2" },
    { id: "hb", name: "Hossein Bagheri", role: "Analyst", team: "Threat Intelligence", color: "#B0506A", load: 55, open: 4, shift: null },
    { id: "ln", name: "Leila Nouri", role: "SOC Manager", team: "SOC", color: "#4F7A3A", load: 60, open: 6, shift: null },
    { id: "kf", name: "Kaveh Farahani", role: "Security Manager", team: "Security Department", color: "#6B6F7A", load: 30, open: 2, shift: null },
  ];
  const P = Object.fromEntries(people.map(p => [p.id, p]));
  const tasks = [
    ["T-1042","Tune Splunk correlation rule for anomalous VPN logins","sr","SOC · L1","progress","high",3,"2026-09-29",6.5,null,"2h"],
    ["T-1041","Document phishing triage playbook v2","am","SOC · L2","review","normal",2,"2026-09-30",4,null,"4h"],
    ["T-1039","Automate MISP → blocklist export pipeline","ms","Design & Automation","progress","critical",4,"2026-09-27",14,null,"12m"],
    ["T-1038","Quarterly review of scanner coverage gaps","rj","SOC · L3","todo","normal",3,"2026-10-04",0,null,"1d"],
    ["T-1036","Update IOC enrichment script for new feed format","hb","Threat Intelligence","blocked","high",3,"2026-10-01",3,null,"1d"],
    ["T-1035","Onboard new L1 analyst to shift procedures","sr","SOC · L1","done","normal",1,"2026-09-25",2,"excellent","3d"],
    ["T-1033","Draft monthly traffic trend summary for leadership","nk","SOC · L1","returned","normal",2,"2026-09-28",3,null,"5h"],
    ["T-1031","Grafana alert thresholds for website latency","ms","Design & Automation","done","high",2,"2026-09-22",5,"good","6d"],
    ["T-1030","Review Security Center website access logs","am","SOC · L2","todo","low",1,"2026-10-06",0,null,"2d"],
    ["T-1028","Build dashboard for sensor health KPIs","rj","SOC · L3","backlog","normal",4,"—",0,null,"1w"],
    ["T-1027","Threat landscape brief: banking sector","hb","Threat Intelligence","done","normal",3,"2026-09-20",9,"acceptable","8d"],
    ["T-1025","Clean up duplicate tickets in tracking sheet","nk","SOC · L1","cancelled","low",1,"—",0.5,null,"9d"],
  ].map(([id,title,a,team,status,prio,cx,due,hours,quality,upd]) => ({id,title,a,team,status,prio,cx,due,hours,quality,upd}));
  const activities = [
    { n:1, title:"Review Logged Incidents in Splunk Incident Review", kind:"basic", done:true },
    { n:2, title:"Upload Malicious IP and Domain Files to the Website", kind:"files", done:true, files:[["malicious_ips_0928.txt","14 KB","TXT"],["malicious_domains_0928.txt","9 KB","TXT"]] },
    { n:3, title:"Review Scanner and Sensor Dashboards", kind:"monitor", done:true, issue:{summary:"Sensor S-04 stopped reporting at 06:40", ref:"GRAF-SENSOR-04"} },
    { n:4, title:"Prepare Daily Traffic Report", kind:"report", done:true, files:[["Daily_Traffic_Report_2026-09-28.docx","248 KB","DOC"]] },
    { n:5, title:"Monitor Website Status in Grafana", kind:"monitor", done:true },
    { n:6, title:"Monitor Security Center Website", kind:"monitor", done:false },
    { n:7, title:"Monitor Security News", kind:"basic", done:true },
    { n:8, title:"Add IOCs to MISP and Share Them via Bale", kind:"misp", done:true, iocs:6, bale:true },
  ];
  const tickets = [
    { no:"INC-2026-4471", ref:"Splunk NE #88213", desc:"Repeated failed admin logins from single ASN" },
    { no:"INC-2026-4476", ref:"Sensor S-04", desc:"Sensor outage escalated to infrastructure" },
  ];
  const ticketLog = [
    ["sr","2026-09-28","INC-2026-4476","Sensor S-04","Sensor outage escalated to infrastructure"],
    ["sr","2026-09-28","INC-2026-4471","Splunk NE #88213","Repeated failed admin logins from single ASN"],
    ["am","2026-09-27","INC-2026-4462","Splunk NE #88190","Suspicious PowerShell on finance workstation"],
    ["nk","2026-09-27","INC-2026-4459","MISP event 5521","Known C2 domain resolved by internal host"],
    ["rj","2026-09-26","INC-2026-4450","Splunk NE #88102","Outbound traffic spike to unusual port"],
    ["sr","2026-09-25","INC-2026-4441","Grafana WEB-01","Website 5xx rate above threshold"],
    ["am","2026-09-24","INC-2026-4433","Splunk NE #88011","Mailbox rule forwarding externally"],
  ];
  return { people, P, tasks, activities, tickets, ticketLog };
})();
