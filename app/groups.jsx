// Object 2: Modality Group Summary Panel

function GroupDetailModal({ group, onClose }) {
  const pct = Math.min(100, Math.round((group.qtyUpdated / group.qtyOrig) * 100));
  const finished = group.finished || pct >= 100;

  // Close on backdrop click
  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onBackdrop}>
      <div className="modal-box" role="dialog" aria-modal="true">

        {/* ── Modal header ── */}
        <div className="modal-header">
          <div className="icon-wrap" style={{
            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: modTintBg(group.modality),
            color: modColor(group.modality),
          }}>
            <ModIcon code={group.modality} size={15}/>
          </div>
          <span className="modal-title">{group.name}</span>
          <ModChip code={group.modality}/>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <I.X size={15}/>
          </button>
        </div>

        <div className="modal-body">

          {/* ── Group header data — ONE block per group ── */}
          <div>
            <div className="modal-section-title">Group Summary</div>
            <div className="modal-group-header">
              <div className="modal-stat">
                <div className="lbl">Group ID</div>
                <div className="val small" style={{fontFamily: "'JetBrains Mono', monospace"}}>
                  {group.id.toUpperCase()}
                </div>
              </div>
              <div className="modal-stat">
                <div className="lbl">Discount</div>
                <div className="val" style={{color: 'var(--teal-700)'}}>{group.discount}%</div>
              </div>
              <div className="modal-stat">
                <div className="lbl">Status</div>
                <div style={{marginTop: 4}}>
                  <span className={"status-chip " + (finished ? 'finished' : 'in-progress')}>
                    <span className="dot"/>
                    {finished ? 'Finished' : 'In Progress'}
                  </span>
                </div>
              </div>
              <div className="modal-stat">
                <div className="lbl">Original Qty</div>
                <div className="val">{group.qtyOrig.toLocaleString()}</div>
              </div>
              <div className="modal-stat">
                <div className="lbl">Updated Qty</div>
                <div className="val">{group.qtyUpdated.toLocaleString()}</div>
              </div>
              <div className="modal-stat">
                <div className="lbl">Completion</div>
                <div className="val">{pct}%</div>
              </div>
              <div className="modal-stat">
                <div className="lbl">1st Threshold Vol.</div>
                <div className="val">{group.firstThreshVol.toLocaleString()}</div>
              </div>
              <div className="modal-stat">
                <div className="lbl">Discount (1st)</div>
                <div className="val" style={{display: 'flex', alignItems: 'center', gap: 6}}>
                  <DiscountBadge value={group.firstThreshDiscount} variant="first"/>
                </div>
              </div>
              <div className="modal-stat">
                <div className="lbl">2nd Threshold Vol.</div>
                <div className="val">{group.secondThreshVol.toLocaleString()}</div>
              </div>
              <div className="modal-stat">
                <div className="lbl">Discount (2nd)</div>
                <div className="val" style={{display: 'flex', alignItems: 'center', gap: 6}}>
                  <DiscountBadge value={group.secondThreshDiscount} variant="second"/>
                </div>
              </div>
            </div>
          </div>

          {/* ── Modality IDs — all items for this group ── */}
          {group.items && group.items.length > 0 && (
            <div>
              <div className="modal-section-title">
                <I.Layers size={12}/>
                Modality IDs
                <span className="pill">{group.items.length}</span>
              </div>
              <table className="modal-table">
                <thead>
                  <tr>
                    <th style={{textAlign: 'left'}}>Modality ID</th>
                    <th style={{textAlign: 'left'}}>Exam Code</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(item => (
                    <tr key={item.id}>
                      <td><span className="mid-id">{item.id}</span></td>
                      <td><span className="exam-code-cell">{item.code}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function DiscountBadge({ value, variant }) {
  const s = variant === 'second'
    ? { background: 'var(--violet-50)', color: '#6D28D9', border: '1px solid color-mix(in oklab, var(--violet) 22%, transparent)' }
    : { background: 'var(--blue-50)',   color: '#1D4ED8', border: '1px solid color-mix(in oklab, var(--blue)   22%, transparent)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
      ...s,
    }}>{value}%</span>
  );
}

function GroupCard({ group, onToggle, onUpdate, readOnly }) {
  const pct = Math.min(100, Math.round((group.qtyUpdated / group.qtyOrig) * 100));
  const finished = group.finished || pct >= 100;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.qtyUpdated);
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const hasItems = group.items && group.items.length > 0;

  useEffect(() => { setDraft(group.qtyUpdated); }, [group.qtyUpdated]);

  const commit = () => {
    const n = Math.max(0, Math.min(group.qtyOrig, parseInt(draft || 0, 10) || 0));
    onUpdate({ ...group, qtyUpdated: n, finished: n >= group.qtyOrig ? true : group.finished });
    setEditing(false);
  };

  const TH = ({ children, align }) => (
    <th style={{
      padding: '7px 10px',
      fontWeight: 600, fontSize: '10.5px', textTransform: 'uppercase',
      letterSpacing: '.04em', color: 'var(--muted)',
      background: 'color-mix(in oklab, var(--surface-2) 80%, var(--surface))',
      borderBottom: '1px solid var(--border)',
      textAlign: align || 'left', whiteSpace: 'nowrap',
    }}>{children}</th>
  );

  const TD = ({ children, align, mono, i }) => (
    <td style={{
      padding: '8px 10px',
      borderBottom: '1px solid var(--border)',
      background: i % 2 !== 0 ? 'color-mix(in oklab, var(--surface-2) 40%, transparent)' : 'transparent',
      textAlign: align || 'left',
      fontSize: 12.5,
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      color: 'var(--ink)',
    }}>{children}</td>
  );

  return (
    <div className="group-card">
      <div className="head">
        <div className="icon-wrap" style={{background: modTintBg(group.modality), color: modColor(group.modality)}}>
          <ModIcon code={group.modality}/>
        </div>
        <div>
          <div className="name">{group.name}</div>
          <div className="meta">
            <ModChip code={group.modality}/>
            <span style={{marginLeft: 8}}>ID <span className="mono" style={{color: 'var(--ink-2)'}}>{group.id.toUpperCase()}</span></span>
          </div>
        </div>
      </div>

      <div className="qty-row">
        <div className="qty-tile">
          <div className="lbl">Original qty</div>
          <div className="val">{group.qtyOrig}</div>
        </div>
        <div className={"qty-tile" + (editing ? ' editable' : '')} onClick={() => setEditing(true)}>
          <div className="lbl" style={{display: 'flex', alignItems: 'center', gap: 4}}>
            Updated qty <I.Edit size={10} style={{opacity: .6}}/>
          </div>
          {editing ? (
            <input autoFocus type="number" min={0} max={group.qtyOrig} value={draft}
                   onChange={e => setDraft(e.target.value)}
                   onBlur={commit}
                   onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(group.qtyUpdated); setEditing(false); } }}/>
          ) : (
            <div className="val">
              {group.qtyUpdated}
              <span className="delta">+{group.qtyUpdated - Math.floor(group.qtyOrig * 0.3)}</span>
            </div>
          )}
        </div>
      </div>

      {!readOnly && (
        <div style={{position: 'relative', marginBottom: 16, marginTop: 16}}>
          <span style={{position: 'absolute', right: 0, top: -16, fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums'}}>{pct}%</span>
          <div className={"progress " + (finished ? 'finished' : 'in-progress')}>
            <div style={{width: pct + '%'}}/>
          </div>
        </div>
      )}

      {/* ── Threshold fields: 4-column inline row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1,
        margin: '12px 0',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--border)',
      }}>
        {[
          { label: '1st Thresh Vol',  value: group.firstThreshVol,       badge: false, color: '#0369A1', variant: null     },
          { label: 'Discount (1st)',  value: group.firstThreshDiscount,  badge: true,  color: null,      variant: 'first'  },
          { label: '2nd Thresh Vol',  value: group.secondThreshVol,      badge: false, color: '#6D28D9', variant: null     },
          { label: 'Discount (2nd)',  value: group.secondThreshDiscount, badge: true,  color: null,      variant: 'second' },
        ].map(({ label, value, badge, color, variant }) => (
          <div key={label} style={{
            background: 'var(--surface)',
            padding: '8px 10px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '.05em', color: 'var(--muted)',
              whiteSpace: 'nowrap', textAlign: 'center',
            }}>{label}</div>
            {badge
              ? <DiscountBadge value={value} variant={variant}/>
              : <span style={{
                  fontSize: 15, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums', color,
                }}>{value.toLocaleString()}</span>
            }
          </div>
        ))}
      </div>

      <div className="group-foot">
        <span className={"status-chip " + (finished ? 'finished' : 'in-progress')}>
          <span className="dot"/>
          {finished ? 'Finished' : 'In Progress'}
        </span>
        {!readOnly && <span style={{fontSize: 11, color: 'var(--muted)', marginLeft: 'auto', marginRight: 4}}>Mark finished</span>}
        {!readOnly && <button className="switch" data-on={finished} onClick={() => onToggle(group)} aria-label="Toggle finished"/>}
      </div>

      {modalOpen && <GroupDetailModal group={group} onClose={() => setModalOpen(false)}/>}

      {/* ── Expand trigger ── */}
      {hasItems && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: '100%', marginTop: 10,
            padding: '7px 10px',
            display: 'flex', alignItems: 'center', gap: 7,
            background: expanded
              ? 'color-mix(in oklab, var(--accent) 8%, var(--surface-2))'
              : 'var(--surface-2)',
            border: '1px solid ' + (expanded
              ? 'color-mix(in oklab, var(--accent) 35%, var(--border))'
              : 'var(--border)'),
            borderRadius: 'var(--radius)',
            color: expanded ? 'var(--accent-700)' : 'var(--muted)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: 'background .15s, border-color .15s, color .15s',
          }}
        >
          <I.Chevron size={13} style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform .2s',
            flexShrink: 0,
          }}/>
          <span>Modalities</span>
          <span style={{
            padding: '1px 7px', borderRadius: 999,
            background: expanded
              ? 'color-mix(in oklab, var(--accent) 18%, transparent)'
              : 'var(--surface)',
            border: '1px solid var(--border)',
            fontSize: 11, fontWeight: 600,
            color: expanded ? 'var(--accent-700)' : 'var(--muted)',
            fontVariantNumeric: 'tabular-nums',
          }}>{group.items.length}</span>
          <span style={{marginLeft: 'auto', fontSize: 11, color: 'var(--muted-2)'}}>
            {expanded ? 'Collapse' : 'Show details'}
          </span>
          <I.ChevronDown size={12} style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform .2s', flexShrink: 0,
          }}/>
        </button>
      )}

      {/* ── Expanded modalities table ── */}
      {expanded && hasItems && (
        <div style={{
          marginTop: 8,
          border: '1px solid color-mix(in oklab, var(--accent) 30%, var(--border))',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px color-mix(in oklab, var(--accent) 8%, transparent)',
        }}>
          {/* Table header */}
          <div style={{
            padding: '8px 12px 6px',
            background: 'color-mix(in oklab, var(--accent) 5%, var(--surface))',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <I.Layers size={13} style={{color: 'var(--accent)'}}/>
            <span style={{fontSize: 12, fontWeight: 600, color: 'var(--ink)'}}>Modality Details</span>
            <span style={{
              marginLeft: 4, padding: '1px 7px', borderRadius: 999,
              background: 'color-mix(in oklab, var(--accent) 15%, transparent)',
              border: '1px solid color-mix(in oklab, var(--accent) 28%, transparent)',
              fontSize: 10.5, fontWeight: 600, color: 'var(--accent-700)',
            }}>{group.items.length} {group.items.length === 1 ? 'modality' : 'modalities'}</span>
          </div>

          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
              <thead>
                <tr>
                  <TH>Modality ID</TH>
                  <TH>Exam Code</TH>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, i) => (
                  <tr key={item.id}>
                    <TD i={i}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11.5, fontWeight: 600,
                        color: 'var(--ink)',
                      }}>{item.id}</span>
                    </TD>
                    <TD i={i}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11.5, fontWeight: 400,
                        color: 'var(--muted)',
                      }}>{item.code}</span>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function modTintBg(code) {
  return {
    CT: '#EFF6FF', MRI: '#F5F3FF', XR: '#FFFBEB', US: '#F0FDFA', PET: '#FFF1F2', NM: '#ECFDF5', MG: '#FDF2F8'
  }[code] || 'var(--surface-2)';
}
function ModIcon({ code, size = 18 }) {
  const common = { size, stroke: 1.75 };
  switch (code) {
    case 'CT':  return <I.Scan {...common}/>;
    case 'MRI': return <I.Layers {...common}/>;
    case 'XR':  return <I.Activity {...common}/>;
    case 'US':  return <I.Wifi {...common}/>;
    case 'PET': return <I.Zap {...common}/>;
    case 'NM':  return <I.BarChart {...common}/>;
    case 'MG':  return <I.Clipboard {...common}/>;
    default:    return <I.Scan {...common}/>;
  }
}

function ModalityGroups({ groups, setGroups, readOnly }) {
  const toggle = (g) => setGroups(gs => gs.map(x => x.id === g.id ? { ...x, finished: !x.finished } : x));
  const update = (g) => setGroups(gs => gs.map(x => x.id === g.id ? g : x));
  const finishedCount = groups.filter(g => g.finished).length;

  return (
    <div className="card">
      <div className="card-head">
        <h2><I.Layers size={15}/> Modality Groups</h2>
        <span className="sub">· {finishedCount} of {groups.length} complete</span>
        <div className="spacer"/>
        {!readOnly && <button className="btn ghost sm"><I.Sliders size={13}/> Bulk edit</button>}
        {!readOnly && <button className="btn primary sm"><I.Plus size={13}/> New group</button>}
      </div>
      <div className="groups-grid">
        {groups.map(g => (
          <GroupCard key={g.id} group={g} onToggle={toggle} onUpdate={update} readOnly={readOnly}/>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ModalityGroups, GroupCard, GroupDetailModal, ModIcon, modTintBg, DiscountBadge });
