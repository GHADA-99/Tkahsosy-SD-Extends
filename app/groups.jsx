// Object 2: Modality Group Summary Panel

function GroupDetailModal({ group, onClose }) {
  const pct = Math.min(100, Math.round((group.qtyUpdated / group.qtyOrig) * 100));
  const finished = group.finished || pct >= 100;
  const [expandedItems, setExpandedItems] = useState(() => new Set());
  const toggleItem = (id) => setExpandedItems(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

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
              {finished && (
                <div className="modal-stat">
                  <div className="lbl">Status</div>
                  <div style={{marginTop: 4}}>
                    <span className="status-chip finished">
                      <span className="dot"/>
                      Finished
                    </span>
                  </div>
                </div>
              )}
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
              <div style={{border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden'}}>
                {group.items.map((item, i) => {
                  const sms = item.serviceTypes || [];
                  const open = expandedItems.has(item.id);
                  return (
                    <div key={item.id} style={{borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none'}}>
                      <button
                        onClick={() => toggleItem(item.id)}
                        style={{
                          width: '100%', padding: '9px 12px',
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: open ? 'color-mix(in oklab, var(--accent) 6%, var(--surface))' : 'var(--surface)',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          transition: 'background .15s',
                        }}
                      >
                        <I.ChevronRight size={13} style={{
                          color: 'var(--accent)',
                          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform .2s', flexShrink: 0,
                        }}/>
                        <span className="mid-id" style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700}}>{item.id}</span>
                        <span style={{
                          marginLeft: 4, padding: '1px 7px', borderRadius: 999,
                          background: open
                            ? 'color-mix(in oklab, var(--accent) 15%, transparent)'
                            : 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          fontSize: 10.5, fontWeight: 600,
                          color: open ? 'var(--accent-700)' : 'var(--muted)',
                        }}>
                          {sms.length} material{sms.length !== 1 ? 's' : ''}
                        </span>
                        <I.ChevronDown size={11} style={{
                          marginLeft: 'auto', color: 'var(--muted)',
                          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform .2s', flexShrink: 0,
                        }}/>
                      </button>
                      {open && (
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          background: 'color-mix(in oklab, var(--accent) 3%, var(--surface-2))',
                        }}>
                          {sms.length === 0
                            ? <div style={{padding: '10px 12px 10px 36px', fontSize: 12, color: 'var(--muted)'}}>No service materials</div>
                            : sms.map((st, j) => (
                              <div key={st.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '7px 12px 7px 36px',
                                borderBottom: j < sms.length - 1 ? '1px solid color-mix(in oklab, var(--border) 60%, transparent)' : 'none',
                              }}>
                                <span style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontSize: 11, fontWeight: 600, color: 'var(--accent-700)',
                                  background: 'color-mix(in oklab, var(--accent) 8%, transparent)',
                                  border: '1px solid color-mix(in oklab, var(--accent) 22%, var(--border))',
                                  padding: '1px 7px', borderRadius: 4, flexShrink: 0,
                                }}>{st.id}</span>
                                <span style={{fontSize: 12, color: 'var(--ink-2)'}}>{st.name}</span>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
  const [expandedItems, setExpandedItems] = useState(() => new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const hasItems = group.items && group.items.length > 0;

  const toggleItem = (id) => setExpandedItems(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  useEffect(() => { setDraft(group.qtyUpdated); }, [group.qtyUpdated]);

  const commit = () => {
    const n = Math.max(0, Math.min(group.qtyOrig, parseInt(draft || 0, 10) || 0));
    onUpdate({ ...group, qtyUpdated: n, finished: n >= group.qtyOrig ? true : group.finished });
    setEditing(false);
  };

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
        {finished && (
          <span className="status-chip finished">
            <span className="dot"/>
            Finished
          </span>
        )}
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

      {/* ── Expanded modalities accordion ── */}
      {expanded && hasItems && (
        <div style={{
          marginTop: 8,
          border: '1px solid color-mix(in oklab, var(--accent) 30%, var(--border))',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px color-mix(in oklab, var(--accent) 8%, transparent)',
        }}>
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

          {group.items.map((item, i) => {
            const sms = item.serviceTypes || [];
            const open = expandedItems.has(item.id);
            return (
              <div key={item.id} style={{borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none'}}>
                <button
                  onClick={() => toggleItem(item.id)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: open ? 'color-mix(in oklab, var(--accent) 6%, var(--surface))' : 'var(--surface)',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    transition: 'background .15s',
                  }}
                >
                  <I.ChevronRight size={13} style={{
                    color: 'var(--accent)',
                    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform .2s', flexShrink: 0,
                  }}/>
                  <span style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 700, color: 'var(--ink)'}}>{item.id}</span>
                  <span style={{
                    marginLeft: 4, padding: '1px 7px', borderRadius: 999,
                    background: open ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    fontSize: 10.5, fontWeight: 600,
                    color: open ? 'var(--accent-700)' : 'var(--muted)',
                  }}>
                    {sms.length} material{sms.length !== 1 ? 's' : ''}
                  </span>
                  <I.ChevronDown size={11} style={{
                    marginLeft: 'auto', color: 'var(--muted)',
                    transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform .2s', flexShrink: 0,
                  }}/>
                </button>
                {open && (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    background: 'color-mix(in oklab, var(--accent) 3%, var(--surface-2))',
                  }}>
                    {sms.length === 0
                      ? <div style={{padding: '10px 12px 10px 36px', fontSize: 12, color: 'var(--muted)'}}>No service materials</div>
                      : sms.map((st, j) => (
                        <div key={st.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 12px 7px 36px',
                          borderBottom: j < sms.length - 1 ? '1px solid color-mix(in oklab, var(--border) 60%, transparent)' : 'none',
                        }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11, fontWeight: 600, color: 'var(--accent-700)',
                            background: 'color-mix(in oklab, var(--accent) 8%, transparent)',
                            border: '1px solid color-mix(in oklab, var(--accent) 22%, var(--border))',
                            padding: '1px 7px', borderRadius: 4, flexShrink: 0,
                          }}>{st.id}</span>
                          <span style={{fontSize: 12, color: 'var(--ink-2)'}}>{st.name}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            );
          })}
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

function ModalityGroups({ groups, setGroups, readOnly, onToast, onSMExport, onSMImport }) {
  const toggle = (g) => setGroups(gs => gs.map(x => x.id === g.id ? { ...x, finished: !x.finished } : x));
  const update = (g) => setGroups(gs => gs.map(x => x.id === g.id ? g : x));
  const finishedCount = groups.filter(g => g.finished).length;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const handleDeleteAll = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    let failed = 0;

    // 1 — service types (leaf)
    for (const g of groups) {
      for (const item of (g.items || [])) {
        for (const st of (item.serviceTypes || [])) {
          const res = await fetch(`/api/ModalityServiceTypes('${encodeURIComponent(st.id)}')`, { method: 'DELETE' });
          if (!res.ok) failed++;
        }
      }
    }
    // 2 — items
    for (const g of groups) {
      for (const item of (g.items || [])) {
        const res = await fetch(`/api/ModalityGroupItems('${encodeURIComponent(item.id)}')`, { method: 'DELETE' });
        if (!res.ok) failed++;
      }
    }
    // 3 — groups (root)
    for (const g of groups) {
      const res = await fetch(`/api/ModalityGroups('${encodeURIComponent(g.id)}')`, { method: 'DELETE' });
      if (!res.ok) failed++;
    }

    const total = groups.length;
    setGroups([]);
    setDeleting(false);
    if (failed === 0) {
      onToast && onToast(`Deleted all ${total} modality group${total !== 1 ? 's' : ''}`);
    } else {
      onToast && onToast(`Done — ${failed} record${failed !== 1 ? 's' : ''} failed to delete`);
    }
  };

  return (
    <div className="card">
      {/* Confirmation modal */}
      {confirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 24, width: 380,
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10}}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: 'var(--rose-50)', display: 'grid', placeItems: 'center',
              }}>
                <I.Trash size={17} style={{color: 'var(--rose)'}}/>
              </div>
              <div style={{fontWeight: 600, fontSize: 14}}>Delete all modality groups?</div>
            </div>
            <p style={{fontSize: 13, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5}}>
              This will permanently delete all <strong>{groups.length}</strong> modality group{groups.length !== 1 ? 's' : ''}, their items, and service types. This cannot be undone.
            </p>
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
              <button className="btn ghost sm" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn danger sm" onClick={handleDeleteAll}
                style={{background: 'var(--rose)', color: '#fff', border: 'none'}}>
                <I.Trash size={13}/> Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card-head">
        <h2><I.Layers size={15}/> Modality Groups</h2>

        <div className="spacer"/>
        {!readOnly && <button className="btn ghost sm"><I.Sliders size={13}/> Bulk edit</button>}
        {!readOnly && <button className="btn primary sm"><I.Plus size={13}/> New group</button>}
        <button
          className="btn sm"
          onClick={() => groups.length > 0 && setConfirmOpen(true)}
          disabled={deleting || groups.length === 0}
          style={{display: 'inline-flex', alignItems: 'center', gap: 5,
            color: groups.length > 0 ? 'var(--rose)' : undefined,
            borderColor: groups.length > 0 ? 'color-mix(in oklab, var(--rose) 40%, var(--border))' : undefined}}
        >
          {deleting
            ? <><span style={{width:6,height:6,borderRadius:'50%',background:'currentColor',display:'inline-block',opacity:.5}}/> Deleting…</>
            : <><I.Trash size={13}/> Delete All</>}
        </button>
      </div>
      <div className="groups-grid">
        {groups.map(g => (
          <GroupCard key={g.id} group={g} onToggle={toggle} onUpdate={update} readOnly={readOnly}/>
        ))}
        {groups.length === 0 && (
          <div style={{gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13}}>
            No modality groups.
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ModalityGroups, GroupCard, GroupDetailModal, ModIcon, modTintBg, DiscountBadge });
