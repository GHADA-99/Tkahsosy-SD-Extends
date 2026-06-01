// Object 1: Transaction Feed Panel
function ModChip({ code }) {
  const m = MODALITIES.find(x => x.code === code) || MODALITIES[0];
  return (
    <span className={`mod mod-${code}`}>
      <span className="mod-dot"/>{m.label.toUpperCase().replace(' SCAN','')}
    </span>
  );
}

function fmtDMY(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function TransactionFeed({ transactions, filters, setFilters, liveSync, showArabic, onImport = () => {}, onDelete = () => {}, onToast = () => {} }) {
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const fileInputRef = useRef(null);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filters.mod !== 'all' && t.mod !== filters.mod) return false;
      if (filters.q && !(`${t.id} ${t.code} ${t.en}`.toLowerCase().includes(filters.q.toLowerCase()))) return false;
      if (filters.range === 'today' && !sameDay(t.date, new Date())) return false;
      if (filters.range === '7d') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        if (t.date < cutoff) return false;
      }
      return true;
    });
  }, [transactions, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const modChips = ['all', ...MODALITIES.map(m => m.code)];

  // ── Selection helpers ────────────────────────────────────────────────────────
  const pagedIds       = paged.map(t => t.id);
  const allPageSel     = pagedIds.length > 0 && pagedIds.every(id => selected.has(id));
  const somePageSel    = pagedIds.some(id => selected.has(id));

  const toggleRow = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const togglePage = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSel) pagedIds.forEach(id => next.delete(id));
      else            pagedIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    let failed = 0;
    for (const id of selected) {
      const res = await fetch(`/api/Transactions('${encodeURIComponent(id)}')`, { method: 'DELETE' });
      if (!res.ok) failed++;
    }
    const count = selected.size;
    onDelete(new Set(selected));
    setSelected(new Set());
    setDeleting(false);
    if (failed === 0) onToast(`Deleted ${count} transaction${count !== 1 ? 's' : ''}`);
    else              onToast(`Done — ${failed} record${failed !== 1 ? 's' : ''} failed to delete`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    const existingIds = new Set(transactions.map(t => t.id));
    const newRows = rows.filter(r => r['Transaction ID'] && !existingIds.has(String(r['Transaction ID'])));

    if (newRows.length === 0) {
      onToast('No new transactions found in file');
      return;
    }

    let saved = 0;
    const imported = [];
    for (const r of newRows) {
      const parts = String(r['Date'] || '').split('-');
      const txDate = parts.length === 3
        ? new Date(+parts[2], +parts[1] - 1, +parts[0])
        : new Date();
      const payload = {
        transactionId  : String(r['Transaction ID']),
        serviceMaterial: String(r['Service Material (Exam Code)'] || ''),
        examNameEn     : String(r['Description (EN)']   || ''),
        examNameAr     : String(r['Description (AR)']   || ''),
        modality       : String(r['Modality']           || ''),
        price          : Number(r['Price (SAR)'])        || 0,
        transactionDate: txDate.toISOString(),
        otherNmType    : String(r['Other NM Type']       || ''),
        salesOffice    : String(r['Hospital']        || ''),
        cost           : Number(r['Cost (SAR)'])         || 0,
        discount       : Number(r['Discount (%)'])       || 0,
        radiologist    : String(r['Radiologist']         || ''),
        room           : String(r['Room']                || ''),
      };
      try {
        const res = await fetch('/api/Transactions', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(payload),
        });
        if (res.ok) saved++;
      } catch (_) {}
      imported.push({ id: payload.transactionId, code: payload.serviceMaterial, en: payload.examNameEn, ar: payload.examNameAr, mod: payload.modality, price: payload.price, date: txDate, otherNmType: payload.otherNmType, salesOffice: payload.salesOffice, cost: payload.cost, discount: payload.discount, radiologist: payload.radiologist, room: payload.room, isNew: true });
    }

    onImport(imported);
    onToast(`Imported ${newRows.length} transaction${newRows.length !== 1 ? 's' : ''}${saved < newRows.length ? ` (${newRows.length - saved} failed to save)` : ''}`);
  };

  const exportToExcel = () => {
    const rows = filtered.map(t => ({
      'Transaction ID'  : t.id,
      'Service Material (Exam Code)': t.code,
      'Description (EN)'           : t.en,
      'Description (AR)'           : t.ar,
      'Modality'                   : t.mod,
      'Price (SAR)'                : t.price,
      'Date'                       : fmtDMY(t.date),
      'Other NM Type'              : t.otherNmType || '',
      'Hospital'    : t.salesOffice    || '',
      'Cost (SAR)'      : t.cost           ?? '',
      'Discount (%)'    : t.discount       ?? '',
      'Radiologist'     : t.radiologist    || '',
      'Room'            : t.room           || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, 'transactions.xlsx');
  };

  return (
    <div className="card">
      <div className="controls">
        <div className="input" style={{minWidth: 240}}>
          <I.Search size={13} style={{color: 'var(--muted-2)'}}/>
          <input placeholder="Search by ID, exam code, description…"
                 value={filters.q}
                 onChange={e => setFilters(f => ({...f, q: e.target.value}))}/>
        </div>

        <div className="chip-row" style={{marginLeft: 4}}>
          {modChips.map(c => (
            <button key={c} className="chip-filter" aria-pressed={filters.mod === c}
                    onClick={() => setFilters(f => ({...f, mod: c}))}>
              {c !== 'all' && <span className="dot" style={{background: modColor(c)}}/>}
              {c === 'all' ? 'All modalities' : MODALITIES.find(m => m.code === c)?.label}
            </button>
          ))}
        </div>

        <div className="spacer" style={{flex: 1}}/>

        <select className="select" value={filters.range} onChange={e => setFilters(f => ({...f, range: e.target.value}))}>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="all">All time</option>
        </select>

        <button className="btn sm" onClick={() => fileInputRef.current.click()} style={{display: 'inline-flex', alignItems: 'center', gap: 5}}>
          <I.Upload size={13}/> Import
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{display: 'none'}} onChange={handleImport}/>
        <button className="btn sm" onClick={exportToExcel} style={{display: 'inline-flex', alignItems: 'center', gap: 5}}>
          <I.Download size={13}/> Export
        </button>
        {selected.size > 0 && (
          <button
            className="btn sm"
            onClick={handleDeleteSelected}
            disabled={deleting}
            style={{display: 'inline-flex', alignItems: 'center', gap: 5,
              color: 'var(--rose)',
              borderColor: 'color-mix(in oklab, var(--rose) 40%, var(--border))'}}
          >
            {deleting
              ? <><span style={{width:6,height:6,borderRadius:'50%',background:'currentColor',display:'inline-block',opacity:.5}}/> Deleting…</>
              : <><I.Trash size={13}/> Delete ({selected.size})</>}
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{width: 36, textAlign: 'center'}}>
                <input
                  type="checkbox"
                  checked={allPageSel}
                  ref={el => { if (el) el.indeterminate = somePageSel && !allPageSel; }}
                  onChange={togglePage}
                  style={{cursor: 'pointer', accentColor: 'var(--accent)'}}
                />
              </th>
              <th style={{width: 104}}>ID</th>
              <th style={{width: 160}}>Service Material (Exam Code)</th>
              <th>Description</th>
              <th style={{width: 100}}>Modality</th>
              <th className="num" style={{width: 110}}>Price (ex. tax)</th>
              <th style={{width: 130}}>Date</th>
              <th style={{width: 150}}>Other NM Type</th>
              <th style={{width: 140}}>Hospital</th>
              <th className="num" style={{width: 110}}>Cost (SAR)</th>
              <th className="num" style={{width: 90}}>Discount</th>
              <th style={{width: 150}}>Radiologist</th>
              <th style={{width: 130}}>Room</th>
              <th style={{width: 36}}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map(t => (
              <tr key={t.id} className={t.isNew ? 'is-new' : ''} style={selected.has(t.id) ? {background: 'color-mix(in oklab, var(--accent) 6%, transparent)'} : {}}>
                <td style={{textAlign: 'center'}}>
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleRow(t.id)}
                    style={{cursor: 'pointer', accentColor: 'var(--accent)'}}
                  />
                </td>
                <td>
                  <span className="id-badge"><span className="hash">#</span>{t.id.replace('TX-','')}</span>
                </td>
                <td><span className="exam-code">{t.code}</span></td>
                <td className="desc-cell">
                  <div className="desc-en">{t.en}</div>
                  {showArabic && <div className="desc-ar">{t.ar}</div>}
                </td>
                <td><ModChip code={t.mod}/></td>
                <td className="num"><span className="mono">﷼ {t.price.toLocaleString()}</span></td>
                <td className="muted mono" style={{fontSize: 12}}>{fmtDMY(t.date)}</td>
                <td style={{color: 'var(--ink-2)', fontSize: 12}}>{t.otherNmType || <span style={{color:'var(--muted)'}}>—</span>}</td>
                <td style={{fontSize: 12}}>{t.salesOffice || <span style={{color:'var(--muted)'}}>—</span>}</td>
                <td className="num">
                  {t.cost != null
                    ? <span className="mono">﷼ {t.cost.toLocaleString()}</span>
                    : <span style={{color:'var(--muted)'}}>—</span>}
                </td>
                <td className="num">
                  {t.discount != null
                    ? <span style={{
                        display:'inline-flex', alignItems:'center',
                        padding:'2px 7px', borderRadius:999,
                        fontSize:11, fontWeight:600,
                        background: t.discount > 0 ? 'var(--emerald-50)' : 'var(--surface-2)',
                        color: t.discount > 0 ? '#047857' : 'var(--muted)',
                        border: `1px solid ${t.discount > 0 ? 'color-mix(in oklab,var(--emerald) 25%,transparent)' : 'var(--border)'}`,
                      }}>{t.discount}%</span>
                    : <span style={{color:'var(--muted)'}}>—</span>}
                </td>
                <td style={{fontSize: 12}}>{t.radiologist || <span style={{color:'var(--muted)'}}>—</span>}</td>
                <td style={{fontSize: 12}}>{t.room || <span style={{color:'var(--muted)'}}>—</span>}</td>
                <td>
                  <button className="icon-btn" style={{width: 28, height: 28}} title="More"><I.MoreH size={14}/></button>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan="14" style={{textAlign: 'center', padding: '40px 0', color: 'var(--muted)'}}>
                No transactions match these filters.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        Showing <strong style={{color: 'var(--ink)', margin: '0 4px'}}>{(page-1)*pageSize + 1}-{Math.min(page*pageSize, filtered.length)}</strong> of {filtered.length}
        <div className="spacer"/>
        <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}><I.ChevronLeft size={13}/></button>
        {Array.from({length: Math.min(totalPages, 4)}).map((_, i) => {
          const n = i + 1;
          return <button key={n} className="pg-num" aria-current={page === n} onClick={() => setPage(n)}>{n}</button>;
        })}
        {totalPages > 4 && <span style={{color: 'var(--muted-2)'}}>…</span>}
        <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}><I.ChevronRight size={13}/></button>
      </div>
    </div>
  );
}

function modColor(c) {
  return { CT: '#3B82F6', MRI: '#8B5CF6', XR: '#F59E0B', US: '#0D9488', PET: '#F43F5E', NM: '#10B981', MG: '#EC4899' }[c] || '#94A3B8';
}

Object.assign(window, { TransactionFeed, ModChip, modColor });
