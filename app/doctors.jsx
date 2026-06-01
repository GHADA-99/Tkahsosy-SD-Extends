// Doctors — Overview screen with Export / Import / Delete All
function Doctors({ onToast }) {
  const [items, setItems]             = React.useState([]);
  const [loading, setLoading]         = React.useState(true);
  const [importing, setImporting]     = React.useState(false);
  const [deleting, setDeleting]       = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [search, setSearch]           = React.useState('');
  const fileRef                       = React.useRef(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  function loadDoctors() {
    return fetch('/api/Doctors?$orderby=employeeId')
      .then(r => r.json())
      .then(data => { setItems(data.value || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  React.useEffect(() => { loadDoctors(); }, []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(d =>
      (d.employeeId   || '').toLowerCase().includes(q) ||
      (d.employeeName || '').toLowerCase().includes(q) ||
      (d.employeeType || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  // ── Export ─────────────────────────────────────────────────────────────────
  function handleExport() {
    if (items.length === 0) { onToast && onToast('No doctors to export'); return; }

    const rows = items.map(d => ({
      'Employee ID'  : d.employeeId   || '',
      'Employee Name': d.employeeName || '',
      'Employee Type': d.employeeType || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Doctors');
    XLSX.writeFile(wb, 'doctors.xlsx');
    onToast && onToast(`Exported ${items.length} doctors`);
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
        let rows = [];
        const isCsv = file.name.toLowerCase().endsWith('.csv');

        if (isCsv) {
          // Parse CSV — supports both raw DB column names (employeeId) and Excel-style names (Employee ID)
          const text = new TextDecoder().decode(ev.target.result);
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          const headers = lines[0].split(',').map(h => h.trim());
          rows = lines.slice(1).map(line => {
            const vals = line.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
            return obj;
          }).filter(r => Object.values(r).some(v => v));
        } else {
          const wb = XLSX.read(ev.target.result, { type: 'array' });
          const ws = wb.Sheets['Doctors'];
          if (!ws) {
            onToast && onToast('Invalid file — sheet "Doctors" not found');
            setImporting(false);
            return;
          }
          rows = XLSX.utils.sheet_to_json(ws);
        }

        if (rows.length === 0) {
          onToast && onToast('File is empty');
          setImporting(false);
          return;
        }

        const hdrs = { 'Content-Type': 'application/json' };
        let created = 0, updated = 0, failed = 0;

        for (const row of rows) {
          // Accept both CSV raw names (employeeId) and Excel display names (Employee ID)
          const empId   = String(row['employeeId']   || row['Employee ID']   || '').trim();
          const empName = String(row['employeeName'] || row['Employee Name'] || '').trim();
          const empType = String(row['employeeType'] || row['Employee Type'] || '').trim();
          if (!empId) { failed++; continue; }

          const body = { employeeId: empId, employeeName: empName, employeeType: empType };
          const existing = items.find(d => d.employeeId === empId);

          if (existing) {
            const res = await fetch(
              `/api/Doctors(${existing.ID})`,
              { method: 'PATCH', headers: hdrs, body: JSON.stringify(body) }
            );
            res.ok ? updated++ : failed++;
          } else {
            const res = await fetch(
              '/api/Doctors',
              { method: 'POST', headers: hdrs, body: JSON.stringify(body) }
            );
            res.ok ? created++ : failed++;
          }
        }

        await loadDoctors();

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

  // ── Delete All ─────────────────────────────────────────────────────────────
  async function handleDeleteAll() {
    setConfirmOpen(false);
    setDeleting(true);
    let failed = 0;

    for (const d of items) {
      const res = await fetch(`/api/Doctors(${d.ID})`, { method: 'DELETE' });
      if (!res.ok) failed++;
    }

    await loadDoctors();
    setDeleting(false);

    if (failed === 0) {
      onToast && onToast(`Deleted all ${items.length} doctors`);
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
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: 'var(--rose-50)', display: 'grid', placeItems: 'center',
                color: 'var(--rose)',
              }}>
                <I.Trash size={18}/>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Delete all doctors?</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                  This will permanently remove all {items.length} records from the database.
                </div>
              </div>
            </div>
            <div style={{
              background: 'var(--rose-50)',
              border: '1px solid color-mix(in oklab, var(--rose) 25%, transparent)',
              borderRadius: 'var(--radius)', padding: '8px 12px',
              fontSize: 12, color: 'var(--rose)', marginBottom: 18,
            }}>
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
          <h1>Doctors</h1>
          <p>{loading ? 'Loading…' : `${items.length} employees`}</p>
        </div>
        <div className="spacer"/>
        <div className="input" style={{ width: 260, display: 'flex', alignItems: 'center', gap: 6 }}>
          <I.Search size={14}/>
          <input
            placeholder="Search doctors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          className="btn"
          onClick={() => fileRef.current?.click()}
          disabled={importing || deleting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {importing
            ? <><I.Clock size={14}/> Importing…</>
            : <><I.Upload size={14}/> Import</>}
        </button>
        <button
          className="btn"
          onClick={handleExport}
          disabled={deleting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <I.Download size={14}/> Export
        </button>
        <button
          className="btn"
          onClick={() => setConfirmOpen(true)}
          disabled={deleting || importing || items.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--rose-50)',
            borderColor: 'color-mix(in oklab, var(--rose) 30%, transparent)',
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
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Employee Type</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                    Loading…
                  </td>
                </tr>
              )}
              {importing && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 12, background: 'var(--accent-50)', borderBottom: '1px solid var(--border)' }}>
                    <I.Clock size={13}/> Importing data, please wait…
                  </td>
                </tr>
              )}
              {deleting && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--rose)', padding: 12, background: 'var(--rose-50)', borderBottom: '1px solid color-mix(in oklab, var(--rose) 20%, transparent)' }}>
                    <I.Clock size={13}/> Deleting all records, please wait…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                    {search ? 'No doctors match your search' : 'No doctors yet'}
                  </td>
                </tr>
              )}
              {filtered.map(d => (
                <tr key={d.ID}>
                  <td><span className="exam-code">{d.employeeId || '—'}</span></td>
                  <td><span className="desc-en">{d.employeeName || '—'}</span></td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 999,
                      fontSize: 12, fontWeight: 500,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--ink-2)',
                    }}>
                      {d.employeeType || '—'}
                    </span>
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
                ? `Showing ${filtered.length} of ${items.length} doctors`
                : `${items.length} doctors total`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

window.Doctors = Doctors;
