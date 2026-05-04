// Object 3: Monthly Aggregation → One Service Order per Month
function Aggregation({ transactions, onToast, readOnly }) {
  const currentMonth  = useMemo(() => new Date(), []);
  const monthly       = useMemo(
    () => transactions.filter(t => sameMonth(t.date, currentMonth)),
    [transactions, currentMonth]
  );

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of monthly) {
      if (!map.has(t.code))
        map.set(t.code, { code: t.code, en: t.en, ar: t.ar, mod: t.mod, items: [] });
      map.get(t.code).items.push(t);
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [monthly]);

  const [openId,      setOpenId]      = useState(null);
  const [monthOrder,  setMonthOrder]  = useState(null);   // { id, erpId } once created
  const [generating,  setGenerating]  = useState(false);

  const monthLabel  = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const totalTx     = monthly.length;
  const totalAmount = monthly.reduce((a, t) => a + t.price, 0);

  // Check whether a SO already exists for this month
  useEffect(() => {
    const encoded = encodeURIComponent(`month eq '${monthLabel}'`);
    fetch(`/api/SalesOrders?$filter=${encoded}&$top=1`)
      .then(r => r.json())
      .then(data => {
        if (data.value?.length > 0) {
          const so = data.value[0];
          setMonthOrder({ id: so.salesOrderId, erpId: so.erpSalesOrderId });
        }
      })
      .catch(() => {});
  }, [monthLabel]);

  const createMonthOrder = async () => {
    setGenerating(true);
    const salesOrderId = `SO-${currentMonth.getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`;
    const erpId        = `ERP-SO-${String(Math.floor(88000 + Math.random() * 999))}`;

    try {
      // Create SO header
      await fetch('/api/SalesOrders', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          salesOrderId,
          erpSalesOrderId: erpId,
          month      : monthLabel,
          status     : 'draft',
          totalAmount,
        }),
      });

      // Create one item per transaction
      await Promise.all(monthly.map(t =>
        fetch('/api/SalesOrderItems', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({
            itemId         : `${salesOrderId}-${t.id}`,
            salesOrder_salesOrderId: salesOrderId,
            transactionId  : t.id,
            examCode       : t.code,
            examNameEn     : t.en,
            price          : t.price,
            transactionDate: t.date.toISOString(),
          }),
        }).catch(() => {})
      ));
    } catch (_) {}

    setTimeout(() => {
      setMonthOrder({ id: salesOrderId, erpId });
      setGenerating(false);
      onToast(`Service order ${salesOrderId} created for ${monthLabel}`);
    }, 800);
  };

  const copy = (txt) => {
    navigator.clipboard?.writeText(txt);
    onToast(`Copied ${txt}`);
  };

  const CopyBtn = ({ value }) => (
    <button
      onClick={() => copy(value)}
      title={`Copy ${value}`}
      style={{
        display: 'grid', placeItems: 'center',
        width: 22, height: 22, borderRadius: 4,
        background: 'transparent', border: 'none',
        color: 'var(--muted)', cursor: 'pointer', flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
    >
      <I.Copy size={11}/>
    </button>
  );

  return (
    <div className="card">

      {/* ── Header ── */}
      <div className="agg-head">
        <div>
          <h2>
            <I.Clipboard size={15}/> Service Orders
            <span style={{
              fontSize: 11, fontWeight: 500, color: 'var(--muted)',
              padding: '2px 8px', borderRadius: 999,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
            }}>{monthLabel}</span>
          </h2>
          <div className="sub">
            {groups.length} exam codes · {totalTx} cases · ﷼ {totalAmount.toLocaleString()} total
          </div>
        </div>
        <div className="spacer" style={{flex: 1}}/>

        {/* Create button — only on service orders screen, only if no SO yet */}
        {!readOnly && !monthOrder && (
          <button
            className="btn primary sm"
            disabled={generating || totalTx === 0}
            onClick={createMonthOrder}
            style={{display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13}}
          >
            {generating ? (
              <><span style={{width:6,height:6,borderRadius:'50%',background:'white',display:'inline-block'}}/> Creating…</>
            ) : (
              <><I.Plus size={14}/> Create Service Order</>
            )}
          </button>
        )}
      </div>

      {/* ── Created SO banner ── */}
      {monthOrder && (
        <div style={{
          margin: '0 12px 0',
          padding: '12px 16px',
          background: 'color-mix(in oklab, var(--emerald) 8%, var(--surface))',
          border: '1px solid color-mix(in oklab, var(--emerald) 30%, transparent)',
          borderRadius: 'var(--radius-lg)',
          marginTop: 12,
          marginBottom: 4,
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10}}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, color: '#047857',
            }}>
              <I.Check size={14}/> Service Order Created
            </span>
            <span style={{fontSize: 11, color: 'var(--muted)'}}>
              · {totalTx} transactions · ﷼ {totalAmount.toLocaleString()}
            </span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 11, color: 'var(--muted)', fontWeight: 500}}>Sales Order ID</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                color: 'var(--ink)', background: 'var(--surface)',
                padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)',
              }}>{monthOrder.id}</span>
              <CopyBtn value={monthOrder.id}/>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 11, color: 'var(--muted)', fontWeight: 500}}>ERP Sales Order ID</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                color: 'var(--ink)', background: 'var(--surface)',
                padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)',
              }}>{monthOrder.erpId}</span>
              <CopyBtn value={monthOrder.erpId}/>
            </div>
          </div>
        </div>
      )}

      {/* ── Exam code list ── */}
      <div className="agg-list" style={{marginTop: 8}}>
        {groups.length === 0 && (
          <div style={{padding: '48px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13}}>
            No transactions found for {monthLabel}
          </div>
        )}

        {groups.map(g => {
          const open  = openId === g.code;
          const total = g.items.reduce((a, x) => a + x.price, 0);
          return (
            <div key={g.code} className="agg-group" data-open={open}>
              <button
                className="agg-group-head"
                onClick={() => setOpenId(open ? null : g.code)}
              >
                <I.Chevron size={14} className="chev"/>
                <ModChip code={g.mod}/>
                <div className="code-wrap">
                  <div className="code-main">
                    <span className="exam-code">{g.code}</span>
                    <span style={{fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500}}>{g.en}</span>
                  </div>
                  <div className="code-desc ar" style={{textAlign: 'left'}}>{g.ar}</div>
                </div>
                <span className="count-pill">
                  <span>{g.items.length}</span>
                  <span className="lbl">cases</span>
                </span>
                <span className="count-pill">
                  <span className="mono">﷼ {total.toLocaleString()}</span>
                </span>
                {monthOrder ? (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#047857',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <I.Check size={11}/> Included
                  </span>
                ) : (
                  <span style={{
                    fontSize: 11, color: 'var(--muted)',
                    padding: '3px 8px', borderRadius: 999,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                  }}>Pending</span>
                )}
              </button>

              {open && (
                <div className="agg-group-body">
                  <div className="agg-txn-list">
                    {g.items.map(t => (
                      <div key={t.id} className="agg-txn">
                        <span className="t-date">{fmtShortDate(t.date)}</span>
                        <span className="t-id">{t.id}</span>
                        <span className="t-price mono">﷼ {t.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Aggregation });
