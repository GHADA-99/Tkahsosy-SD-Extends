// Top bar + sidebar shell
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function TopBar({ notifCount, onToggleTheme, dark }) {
  return (
    <header className="topbar">
      <div className="logo">
        <div className="logo-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h4l2-3h4l2 3h4"/>
            <circle cx="12" cy="14" r="5"/>
            <path d="M12 11v6M9 14h6"/>
          </svg>
        </div>
        <span>MedSync</span>
        <span style={{fontSize: 11, color: 'var(--muted-2)', fontWeight: 500, marginLeft: 6, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4}}>v4.2</span>
      </div>

      <div className="topbar-search">
        <I.Search size={15}/>
        <input placeholder="Search transactions, exam codes, patients…" />
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" title="Notifications">
          <I.Bell size={17}/>
          {notifCount > 0 && <span className="badge">{notifCount}</span>}
        </button>
        <button className="icon-btn" title="Toggle theme" onClick={onToggleTheme}>
          {dark ? <I.Sun size={17}/> : <I.Moon size={17}/>}
        </button>
        <button className="icon-btn" title="Help"><I.Help size={17}/></button>
        <div className="avatar" title="Dr. Layla Hamed">LH</div>
      </div>
    </header>
  );
}

function Sidebar({ current, onNav, counts }) {
  const primary = [
    { id: 'dashboard',    label: 'Dashboard',       icon: I.Home },
    { id: 'transactions', label: 'Transactions',    icon: I.Activity, count: counts.tx },
    { id: 'groups',       label: 'Modality Groups', icon: I.Layers,   count: counts.groups },
    { id: 'orders',       label: 'Service Orders',    icon: I.Clipboard, count: counts.orders },
    { id: 'ordersV2',    label: 'Service Orders V2', icon: I.Clipboard, count: counts.ordersV2 },
    { id: 'reports',      label: 'Reports',          icon: I.BarChart },
  ];
  const secondary = [
    { id: 'team',     label: 'Team',     icon: I.Users },
    { id: 'settings', label: 'Settings', icon: I.Settings },
  ];
  return (
    <aside className="sidebar">
      <div className="nav-section">
        <div className="nav-label">Workspace</div>
        {primary.map(n => (
          <button key={n.id} className="nav-item" aria-current={current === n.id}
                  onClick={() => onNav(n.id)}>
            <n.icon size={16}/> {n.label}
            {n.count != null && <span className="count">{n.count}</span>}
          </button>
        ))}
      </div>
      <div className="nav-section">
        <div className="nav-label">Account</div>
        {secondary.map(n => (
          <button key={n.id} className="nav-item" aria-current={current === n.id}
                  onClick={() => onNav(n.id)}>
            <n.icon size={16}/> {n.label}
          </button>
        ))}
      </div>

    </aside>
  );
}

function PageHeader({ title, subtitle, tab, onTab, notifCount, liveCount, onExport, onImport, onCalculateDiscount }) {
  return (
    <div className="page-head">
      {tab !== 'groups' && tab !== 'monthly' && <div className="page-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>}
      <div className="spacer"/>
      {tab !== 'groups' && tab !== 'monthly' && <div className="tabs" role="tablist">
        {[
          { id: 'all',     label: 'All Panels', live: true },
          { id: 'feed',    label: 'Live Feed', badge: liveCount },
          { id: 'groups',  label: 'Modality Groups' },
          { id: 'monthly', label: 'Monthly Aggregation' },
        ].map(t => (
          <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}>
            {t.live && <span className="dot"/>}
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span style={{fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: 'var(--rose)', color: 'white'}}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>}
      {tab === 'monthly' && (
        <button className="btn primary sm" onClick={onCalculateDiscount} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
          <I.Zap size={14}/> Calculate Discount
        </button>
      )}
      {onImport && (
        <button className="btn" onClick={onImport}><I.Upload size={14}/> Import</button>
      )}
      <button className="btn" onClick={onExport}><I.Download size={14}/> Export</button>
    </div>
  );
}

function KpiStrip({ tx, groups }) {
  const total = tx.length;
  const today = tx.filter(t => sameDay(t.date, new Date(2026, 3, 22))).length;
  const revenue = tx.reduce((a, t) => a + t.price, 0);
  const finishedGroups = groups.filter(g => g.finished).length;

  const items = [
    { label: 'Transactions · Today',  value: today, unit: 'cases', trend: '+12%', up: true, spark: [4,7,5,9,8,12,11,14,13,16] },
    { label: 'Live Queue',            value: total, unit: 'total', trend: '+3 new', up: true, spark: [20,22,21,24,26,28,27,30,32,34] },
    { label: 'Revenue (ex. tax)',     value: `﷼ ${(revenue/1000).toFixed(1)}k`, unit: 'this month', trend: '+8.4%', up: true, spark: [10,14,13,17,18,22,24,28,30,34] },
    { label: 'Modality Groups',       value: `${finishedGroups}/${groups.length}`, unit: 'finished', trend: '2 closing', up: false, spark: [2,2,3,3,4,4,4,5,5,5] },
  ];
  return (
    <div className="kpi-row">
      {items.map((k, i) => (
        <div key={i} className="kpi">
          <div className="k-label">{k.label}</div>
          <div className="k-value">{k.value} <span className="k-unit">{k.unit}</span></div>
          <div className={"k-trend " + (k.up ? '' : 'down')}>
            {k.up ? <I.ArrowUp size={11}/> : <I.ArrowDown size={11}/>}
            {k.trend}
          </div>
          <Spark data={k.spark}/>
        </div>
      ))}
    </div>
  );
}
function Spark({ data }) {
  const w = 80, h = 32, max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / Math.max(1, max - min)) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".85"/>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="var(--accent)" opacity=".08"/>
    </svg>
  );
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function fmtDate(d) {
  const now = new Date(2026, 3, 22, 14, 12);
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function fmtShortDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

Object.assign(window, { TopBar, Sidebar, PageHeader, KpiStrip, Spark, sameDay, sameMonth, fmtDate, fmtShortDate });
