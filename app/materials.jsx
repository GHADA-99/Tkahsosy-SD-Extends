// Materials — Overview screen with Export / Import / Delete All
function Materials({ onToast }) {
  const [items, setItems]         = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [deleting, setDeleting]   = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [search, setSearch]       = React.useState('');
  const fileRef                   = React.useRef(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  function loadMaterials() {
    return fetch('/api/Materials?$orderby=materialCode')
      .then(r => r.json())
      .then(data => { setItems(data.value || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  React.useEffect(() => { loadMaterials(); }, []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(m =>
      (m.materialCode  || '').toLowerCase().includes(q) ||
      (m.descriptionEn || '').toLowerCase().includes(q) ||
      (m.descriptionAr || '').includes(search) ||
      (m.examCode      || '').toLowerCase().includes(q) ||
      (m.naphisCode    || '').toLowerCase().includes(q) ||
      (m.modality      || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  // ── Export ─────────────────────────────────────────────────────────────────
  function handleExport() {
    if (items.length === 0) { onToast && onToast('No materials to export'); return; }

    const rows = items.map(m => ({
      'Material Code'          : m.materialCode   || '',
      'Description (EN)'       : m.descriptionEn  || '',
      'Description (AR)'       : m.descriptionAr  || '',
      'Modality'               : m.modality        || '',
      'Modality Group'         : m.modalityGroup   || '',
      'Material Group 1'       : m.materialGroup1  || '',
      'Naphys Code'            : m.naphisCode      || '',
      'Scan Type'              : m.scanType        || '',
      'Exam Code'              : m.examCode        || '',
      'Pricing'                : m.pricing != null ? Number(m.pricing) : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      {wch:16},{wch:36},{wch:36},{wch:10},{wch:22},
      {wch:22},{wch:16},{wch:20},{wch:18},{wch:12},
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Materials');
    XLSX.writeFile(wb, 'materials.xlsx');
    onToast && onToast(`Exported ${items.length} materials`);
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' });
        const ws   = wb.Sheets['Materials'];
        if (!ws) {
          onToast && onToast('Invalid file — sheet "Materials" not found');
          setImporting(false);
          return;
        }

        const rows = XLSX.utils.sheet_to_json(ws);
        if (rows.length === 0) {
          onToast && onToast('Sheet is empty');
          setImporting(false);
          return;
        }

        const existingCodes = new Set(items.map(m => m.materialCode));
        const hdrs = { 'Content-Type': 'application/json' };
        let created = 0, updated = 0, failed = 0;

        for (const row of rows) {
          const code = String(row['Material Code'] || '').trim();
          if (!code) { failed++; continue; }

          const pricing = row['Pricing'] !== '' && row['Pricing'] != null
            ? parseFloat(row['Pricing'])
            : null;

          const body = {
            materialCode  : code,
            descriptionEn : String(row['Description (EN)'] || ''),
            descriptionAr : String(row['Description (AR)'] || ''),
            modality      : String(row['Modality']          || ''),
            modalityGroup : String(row['Modality Group']    || ''),
            materialGroup1: String(row['Material Group 1']  || ''),
            naphisCode    : String(row['Naphys Code']       || ''),
            scanType      : String(row['Scan Type']         || ''),
            examCode      : String(row['Exam Code']         || ''),
            pricing       : isNaN(pricing) ? null : pricing,
          };

          if (existingCodes.has(code)) {
            const res = await fetch(
              `/api/Materials('${encodeURIComponent(code)}')`,
              { method: 'PATCH', headers: hdrs, body: JSON.stringify(body) }
            );
            res.ok ? updated++ : failed++;
          } else {
            const res = await fetch(
              '/api/Materials',
              { method: 'POST', headers: hdrs, body: JSON.stringify(body) }
            );
            res.ok ? created++ : failed++;
          }
        }

        // Reload from server so UI reflects persisted state
        await loadMaterials();

        const parts = [];
        if (created > 0) parts.push(`${created} created`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (failed  > 0) parts.push(`${failed} failed`);
        onToast && onToast('Import done — ' + parts.join(', '));
      } catch (err) {
        console.error(err);
        onToast && onToast('Import failed — check file format');
      } finally {
        setImporting(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // ── Delete All ────────────────────────────────────────────────────────────
  async function handleDeleteAll() {
    setConfirmOpen(false);
    setDeleting(true);
    let failed = 0;

    for (const m of items) {
      const res = await fetch(
        `/api/Materials('${encodeURIComponent(m.materialCode)}')`,
        { method: 'DELETE' }
      );
      if (!res.ok) failed++;
    }

    await loadMaterials();
    setDeleting(false);

    if (failed === 0) {
      onToast && onToast(`Deleted all ${items.length} materials`);
    } else {
      onToast && onToast(`Done — ${failed} record${failed !== 1 ? 's' : ''} failed to delete`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        style={{display: 'none'}}
        onChange={handleImport}
      />

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
                color: 'var(--rose)',
              }}>
                <I.Trash size={18}/>
              </div>
              <div>
                <div style={{fontWeight: 600, fontSize: 14}}>Delete all materials?</div>
                <div style={{color: 'var(--muted)', fontSize: 12, marginTop: 2}}>
                  This will permanently remove all {items.length} records from the database.
                </div>
              </div>
            </div>
            <div style={{
              background: 'var(--rose-50)', border: '1px solid color-mix(in oklab, var(--rose) 25%, transparent)',
              borderRadius: 'var(--radius)', padding: '8px 12px',
              fontSize: 12, color: 'var(--rose)', marginBottom: 18,
            }}>
              This action cannot be undone.
            </div>
            <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
              <button className="btn" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button
                className="btn"
                onClick={handleDeleteAll}
                style={{
                  background: 'var(--rose)', borderColor: 'var(--rose)', color: 'white',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <I.Trash size={13}/> Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-head">
        <div className="page-title">
          <h1>Materials</h1>
          <p>{loading ? 'Loading…' : `${items.length} records`}</p>
        </div>
        <div className="spacer"/>
        <div className="input" style={{width: 260, display: 'flex', alignItems: 'center', gap: 6}}>
          <I.Search size={14}/>
          <input
            placeholder="Search materials…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          className="btn"
          onClick={() => fileRef.current?.click()}
          disabled={importing || deleting}
          style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
        >
          {importing
            ? <><I.Clock size={14}/> Importing…</>
            : <><I.Upload size={14}/> Import</>}
        </button>
        <button
          className="btn"
          onClick={handleExport}
          disabled={deleting}
          style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
        >
          <I.Download size={14}/> Export
        </button>
        <button
          className="btn"
          onClick={() => setConfirmOpen(true)}
          disabled={deleting || importing || items.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--rose-50)', borderColor: 'color-mix(in oklab, var(--rose) 30%, transparent)',
            color: 'var(--rose)',
          }}
        >
          {deleting
            ? <><I.Clock size={14}/> Deleting…</>
            : <><I.Trash size={14}/> Delete All</>}
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Material Code</th>
                <th>Description (EN)</th>
                <th>Description (AR)</th>
                <th>Modality</th>
                <th>Modality Group</th>
                <th>Material Group 1</th>
                <th>Naphys Code</th>
                <th>Scan Type</th>
                <th>Exam Code</th>
                <th style={{textAlign: 'right'}}>Pricing</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} style={{textAlign: 'center', color: 'var(--muted)', padding: 40}}>
                    Loading…
                  </td>
                </tr>
              )}
              {importing && (
                <tr>
                  <td colSpan={10} style={{textAlign: 'center', color: 'var(--muted)', padding: 12, background: 'var(--accent-50)', borderBottom: '1px solid var(--border)'}}>
                    <I.Clock size={13}/> Importing data, please wait…
                  </td>
                </tr>
              )}
              {deleting && (
                <tr>
                  <td colSpan={10} style={{textAlign: 'center', color: 'var(--rose)', padding: 12, background: 'var(--rose-50)', borderBottom: '1px solid color-mix(in oklab, var(--rose) 20%, transparent)'}}>
                    <I.Clock size={13}/> Deleting all records, please wait…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{textAlign: 'center', color: 'var(--muted)', padding: 40}}>
                    {search ? 'No materials match your search' : 'No materials yet'}
                  </td>
                </tr>
              )}
              {filtered.map(m => (
                <tr key={m.materialCode}>
                  <td><span className="exam-code">{m.materialCode}</span></td>
                  <td><span className="desc-en">{m.descriptionEn || '—'}</span></td>
                  <td>
                    {m.descriptionAr
                      ? <span className="ar" style={{fontSize: 13}}>{m.descriptionAr}</span>
                      : <span style={{color: 'var(--muted)'}}>—</span>}
                  </td>
                  <td>
                    {m.modality
                      ? <span className={`mod mod-${m.modality}`}><span className="mod-dot"/>{m.modality}</span>
                      : <span style={{color: 'var(--muted)'}}>—</span>}
                  </td>
                  <td>{m.modalityGroup  || <span style={{color: 'var(--muted)'}}>—</span>}</td>
                  <td>{m.materialGroup1 || <span style={{color: 'var(--muted)'}}>—</span>}</td>
                  <td><span className="exam-code">{m.naphisCode || '—'}</span></td>
                  <td>{m.scanType || <span style={{color: 'var(--muted)'}}>—</span>}</td>
                  <td><span className="exam-code">{m.examCode || '—'}</span></td>
                  <td className="num">
                    {m.pricing != null
                      ? `﷼ ${Number(m.pricing).toLocaleString('en-SA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                      : <span style={{color: 'var(--muted)'}}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && items.length > 0 && (
          <div className="pagination">
            <span>
              {search
                ? `Showing ${filtered.length} of ${items.length} materials`
                : `${items.length} materials total`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

window.Materials = Materials;
