// Service Orders V2 — Overview · View · Create screens

// ── Helpers ───────────────────────────────────────────────────────────────────
function modalityFromCode(code) {
  const prefix = (code || '').split('-')[0].toUpperCase();
  return ['CT', 'MRI', 'XR', 'US', 'PET', 'NM', 'MG'].includes(prefix) ? prefix : 'CT';
}

// Groups transactions by ModalityGroup.
// Returns [{ id, name, modality, discount, firstThreshVol, firstThreshDiscount,
//            secondThreshVol, secondThreshDiscount, txns, examSubGroups }]
function buildModalityGroupings(transactions) {
  const MG = window.MODALITY_GROUPS || [];

  const codeToGroup = {};
  MG.forEach(mg => {
    (mg.items || []).forEach(item => { codeToGroup[item.code] = mg; });
  });

  const groupMap  = {};
  const ungrouped = [];

  transactions.forEach(t => {
    const mg = codeToGroup[t.code];
    if (mg) {
      if (!groupMap[mg.id]) {
        groupMap[mg.id] = {
          id: mg.id, name: mg.name, modality: mg.modality, discount: mg.discount || 0,
          firstThreshVol      : mg.firstThreshVol       || 0,
          firstThreshDiscount : mg.firstThreshDiscount  || 0,
          secondThreshVol     : mg.secondThreshVol      || 0,
          secondThreshDiscount: mg.secondThreshDiscount || 0,
          txns: [],
        };
      }
      groupMap[mg.id].txns.push(t);
    } else {
      ungrouped.push(t);
    }
  });

  const result = MG.filter(mg => groupMap[mg.id]).map(mg => ({ ...groupMap[mg.id] }));

  if (ungrouped.length > 0) {
    result.push({ id: '__other__', name: 'Other', modality: '', discount: 0,
      firstThreshVol: 0, firstThreshDiscount: 0, secondThreshVol: 0, secondThreshDiscount: 0,
      txns: ungrouped });
  }

  result.forEach(mg => {
    const examMap = new Map();
    mg.txns.forEach(t => {
      if (!examMap.has(t.code))
        examMap.set(t.code, { code: t.code, en: t.en || '', ar: t.ar || '', mod: t.mod || modalityFromCode(t.code), items: [] });
      examMap.get(t.code).items.push(t);
    });
    mg.examSubGroups = [...examMap.values()];
  });

  return result;
}

// Builds a per-transaction discount map and summary rows for the discount card.
// 3-tier rule: cases 1..firstThreshVol → no discount; firstThreshVol+1..secondThreshVol → Discount 1st;
// secondThreshVol+1..end → Discount 2nd. summaryRows carry a `tiers` array for multi-tier rendering.
function buildGroupDiscountMap(groupings) {
  const txnMap      = {};
  const summaryRows = [];

  groupings.forEach(mg => {
    if (mg.id === '__other__') {
      mg.txns.forEach(t => { txnMap[t.id] = 0; });
      return;
    }

    const fv = mg.firstThreshVol  || 0;
    const sv = mg.secondThreshVol || 0;

    // Band 1: cases 1..fv → no discount
    const band1 = mg.txns.slice(0, fv);
    // Band 2: cases fv+1..sv → Discount 1st (extends to end when sv is unset)
    const band2 = sv > 0 ? mg.txns.slice(fv, sv) : mg.txns.slice(fv);
    // Band 3: cases sv+1..end → Discount 2nd (empty when sv is unset)
    const band3 = sv > 0 ? mg.txns.slice(sv) : [];

    band1.forEach(t => { txnMap[t.id] = 0; });
    band2.forEach(t => { txnMap[t.id] = mg.firstThreshDiscount; });
    band3.forEach(t => { txnMap[t.id] = mg.secondThreshDiscount; });

    const tiers = [];
    if (band1.length > 0)
      tiers.push({ txns: band1, count: band1.length, pct: 0,                     label: 'No Discount' });
    if (band2.length > 0)
      tiers.push({ txns: band2, count: band2.length, pct: mg.firstThreshDiscount,  label: '1st Threshold' });
    if (band3.length > 0)
      tiers.push({ txns: band3, count: band3.length, pct: mg.secondThreshDiscount, label: '2nd Threshold' });

    summaryRows.push({ id: mg.id, name: mg.name, mod: mg.modality, txns: mg.txns, tiers });
  });

  return { txnMap, summaryRows };
}

// ── Discount Summary Card ─────────────────────────────────────────────────────
// rows: array from buildGroupDiscountMap summaryRows
function DiscountSummaryCard({ rows, totalAmount, discountedTotal }) {
  const savings = totalAmount - discountedTotal;
  const BADGE = {
    fontWeight: 600, color: '#047857', padding: '2px 8px', borderRadius: 999,
    background: 'var(--emerald-50)',
    border: '1px solid color-mix(in oklab, var(--emerald) 20%, transparent)', fontSize: 11,
  };
  return (
    <div style={{
      margin: '12px 12px 0',
      border: '1px solid color-mix(in oklab, var(--emerald) 35%, transparent)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px',
        background: 'color-mix(in oklab, var(--emerald) 10%, var(--surface))',
        borderBottom: '1px solid color-mix(in oklab, var(--emerald) 20%, transparent)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#047857'}}>
          <I.Zap size={14}/> Discount Summary
        </span>
        <span style={{fontSize: 12, color: 'var(--muted)', marginLeft: 'auto'}}>
          Total savings: <strong style={{color: '#047857'}}>﷼ {savings.toLocaleString()}</strong>
        </span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Modality Group</th>
              <th style={{width: 80}}>Modality</th>
              <th className="num" style={{width: 80}}>Total Cases</th>
              <th className="num" style={{width: 60}}>Cases</th>
              <th className="num" style={{width: 130}}>Original</th>
              <th className="num" style={{width: 90}}>Discount</th>
              <th className="num" style={{width: 140}}>After Discount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <React.Fragment key={r.id}>
                {r.tiers.map((tier, tierIdx) => {
                  const isFirst  = tierIdx === 0;
                  const numTiers = r.tiers.length;
                  const tierSub  = tier.txns.reduce((a, x) => a + x.price, 0);
                  const tierAfter = Math.round(tierSub * (1 - tier.pct / 100));
                  return (
                    <tr key={`${r.id}-${tierIdx}`}>
                      {isFirst && (
                        <>
                          <td rowSpan={numTiers} style={{fontWeight: 500, verticalAlign: 'middle', borderRight: '1px solid var(--border)'}}>
                            {r.name}
                            {numTiers > 1 && <div style={{fontSize: 10, color: 'var(--muted)', marginTop: 3, fontWeight: 400}}>Tiered discount</div>}
                          </td>
                          <td rowSpan={numTiers} style={{verticalAlign: 'middle', borderRight: '1px solid var(--border)'}}>
                            {r.mod ? <ModChip code={r.mod}/> : <span style={{color: 'var(--muted)'}}>—</span>}
                          </td>
                          <td rowSpan={numTiers} className="num" style={{fontWeight: 700, verticalAlign: 'middle', borderRight: '1px solid var(--border)'}}>
                            {r.txns.length}
                          </td>
                        </>
                      )}
                      <td className="num">
                        <div>{tier.count}</div>
                        {numTiers > 1 && <div style={{fontSize: 10, color: 'var(--muted)', marginTop: 1}}>{tier.label}</div>}
                      </td>
                      <td className="num">
                        <span className="mono" style={{textDecoration: tier.pct > 0 ? 'line-through' : 'none', color: tier.pct > 0 ? 'var(--muted-2)' : 'inherit'}}>
                          ﷼ {tierSub.toLocaleString()}
                        </span>
                      </td>
                      <td className="num">
                        {tier.pct > 0 ? <span style={BADGE}>-{tier.pct}%</span> : <span style={{color: 'var(--muted)'}}>—</span>}
                      </td>
                      <td className="num">
                        <span className="mono" style={{fontWeight: tier.pct > 0 ? 600 : 400, color: tier.pct > 0 ? '#047857' : 'inherit'}}>
                          ﷼ {tierAfter.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr style={{background: 'color-mix(in oklab, var(--emerald) 6%, var(--surface))'}}>
              <td colSpan="2" style={{padding: '10px 14px', fontWeight: 700, fontSize: 13}}>Total</td>
              <td className="num" style={{fontWeight: 700}}>{rows.reduce((a, r) => a + r.txns.length, 0)}</td>
              <td className="num" style={{fontWeight: 700}}>{rows.reduce((a, r) => a + r.txns.length, 0)}</td>
              <td className="num">
                <span className="mono" style={{textDecoration: 'line-through', color: 'var(--muted)'}}>
                  ﷼ {totalAmount.toLocaleString()}
                </span>
              </td>
              <td className="num">
                <span style={{fontWeight: 700, color: '#047857', fontSize: 12}}>−﷼ {savings.toLocaleString()}</span>
              </td>
              <td className="num">
                <span className="mono" style={{fontWeight: 700, fontSize: 14, color: '#047857'}}>
                  ﷼ {discountedTotal.toLocaleString()}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Top-level orchestrator ────────────────────────────────────────────────────
function AggregationV2({ onToast, onOrderSaved = () => {}, onOrderDeleted = () => {} }) {
  const [screen,        setScreen]        = useState('overview');
  const [ordersV2,      setOrdersV2]      = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [may2026Txns,   setMay2026Txns]   = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetch('/api/SalesOrdersV2')
      .then(r => r.json())
      .then(data => { if (data.value) setOrdersV2(data.value); })
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, []);

  useEffect(() => {
    const filter = encodeURIComponent(
      "transactionDate ge '2026-05-01T00:00:00Z' and transactionDate lt '2026-06-01T00:00:00Z'"
    );
    fetch(`/api/Transactions?$filter=${filter}&$orderby=transactionDate%20desc`)
      .then(r => r.json())
      .then(data => {
        const mapped = (data.value || []).map(t => ({
          id: t.transactionId, code: t.examCode, en: t.examNameEn,
          ar: t.examNameAr, mod: t.modality, price: t.price,
          date: new Date(t.transactionDate),
        }));
        setMay2026Txns(mapped.length > 0 ? mapped : buildMay2026Transactions());
      })
      .catch(() => setMay2026Txns(buildMay2026Transactions()));
  }, []);

  const goBack = () => { setSelectedOrder(null); setScreen('overview'); };

  const handleDeleteOrder = async (orderId) => {
    const filter = encodeURIComponent(`salesOrder_salesOrderId eq '${orderId}'`);
    const data = await fetch(`/api/SalesOrderItemsV2?$filter=${filter}`).then(r => r.json()).catch(() => ({ value: [] }));
    await Promise.all((data.value || []).map(i =>
      fetch(`/api/SalesOrderItemsV2('${i.itemId}')`, { method: 'DELETE' }).catch(() => {})
    ));
    await fetch(`/api/SalesOrdersV2('${orderId}')`, { method: 'DELETE' }).catch(() => {});
    setOrdersV2(prev => prev.filter(o => o.salesOrderId !== orderId));
    onOrderDeleted();
    onToast(`Order ${orderId} deleted`);
  };

  if (screen === 'view' && selectedOrder) {
    return <ServiceOrderV2View order={selectedOrder} onBack={goBack} onToast={onToast}/>;
  }

  if (screen === 'create') {
    return (
      <ServiceOrderV2Create
        transactions={may2026Txns}
        onBack={() => setScreen('overview')}
        onSaved={(order) => {
          setOrdersV2(prev => [order, ...prev]);
          onOrderSaved();
          setScreen('overview');
        }}
        onToast={onToast}
      />
    );
  }

  return (
    <ServiceOrderV2Overview
      orders={ordersV2}
      loading={loadingOrders}
      onCreateClick={() => setScreen('create')}
      onViewOrder={(order) => { setSelectedOrder(order); setScreen('view'); }}
      onDeleteOrder={handleDeleteOrder}
    />
  );
}

// ── Overview screen ───────────────────────────────────────────────────────────
function ServiceOrderV2Overview({ orders, loading, onCreateClick, onViewOrder, onDeleteOrder }) {
  const [confirmId,  setConfirmId]  = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleConfirmDelete = async (orderId) => {
    setConfirmId(null);
    setDeletingId(orderId);
    await onDeleteOrder(orderId);
    setDeletingId(null);
  };

  return (
    <div className="card">
      <div className="agg-head">
        <div>
          <h2><I.Clipboard size={15}/> Service Orders V2</h2>
          <div className="sub">
            {loading ? 'Loading…' : `${orders.length} service order${orders.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="spacer" style={{flex: 1}}/>
        <button
          className="btn primary sm"
          onClick={onCreateClick}
          style={{display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13}}
        >
          <I.Plus size={14}/> Create Service Order
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{width: 170}}>Sales Order ID</th>
              <th style={{width: 160}}>ERP Order ID</th>
              <th style={{width: 100}}>Month</th>
              <th style={{width: 110}}>Status</th>
              <th className="num" style={{width: 150}}>Total Amount</th>
              <th style={{width: 160}}></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.salesOrderId} style={{cursor: 'pointer'}} onClick={() => onViewOrder(o)}>
                <td>
                  <span className="id-badge">
                    <span className="hash">#</span>{o.salesOrderId.replace('SO2-', '')}
                  </span>
                </td>
                <td><span className="exam-code">{o.erpSalesOrderId || '—'}</span></td>
                <td style={{color: 'var(--ink-2)'}}>{o.month}</td>
                <td>
                  <span className={`status-chip ${o.status === 'submitted' || o.status === 'approved' ? 'finished' : 'in-progress'}`}>
                    <span className="dot"/>{o.status}
                  </span>
                </td>
                <td className="num"><span className="mono">﷼ {(o.totalAmount || 0).toLocaleString()}</span></td>
                <td onClick={e => e.stopPropagation()} style={{textAlign: 'right'}}>
                  {confirmId === o.salesOrderId ? (
                    <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
                      <button className="btn sm" onClick={() => setConfirmId(null)} style={{padding: '0 8px'}}>
                        Cancel
                      </button>
                      <button
                        className="btn sm"
                        onClick={() => handleConfirmDelete(o.salesOrderId)}
                        style={{display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 8px',
                          background: 'var(--rose)', borderColor: 'var(--rose)', color: 'white'}}
                      >
                        <I.Trash size={12}/> Confirm
                      </button>
                    </span>
                  ) : (
                    <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
                      <button
                        className="btn sm"
                        onClick={() => onViewOrder(o)}
                        style={{display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 10px'}}
                      >
                        Open <I.ChevronRight size={13}/>
                      </button>
                      <button
                        className="btn sm"
                        onClick={() => setConfirmId(o.salesOrderId)}
                        disabled={deletingId === o.salesOrderId}
                        style={{display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 8px',
                          color: deletingId === o.salesOrderId ? 'var(--muted)' : 'var(--rose)',
                          borderColor: 'color-mix(in oklab, var(--rose) 30%, var(--border))'}}
                      >
                        {deletingId === o.salesOrderId
                          ? <><span style={{width:6,height:6,borderRadius:'50%',background:'currentColor',display:'inline-block',opacity:.5}}/> Deleting…</>
                          : <I.Trash size={13}/>}
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px 0', color: 'var(--muted)'}}>Loading…</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan="6" style={{textAlign: 'center', padding: '52px 0', color: 'var(--muted)', fontSize: 13}}>
                  No V2 service orders yet.{' '}
                  <button
                    onClick={onCreateClick}
                    style={{color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer'}}
                  >
                    Create your first one
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {orders.length > 0 && (
        <div className="pagination">
          <span>{orders.length} order{orders.length !== 1 ? 's' : ''} total</span>
        </div>
      )}
    </div>
  );
}

// ── Shared: modality-group accordion renderer ─────────────────────────────────
// discountMap is keyed by transaction ID (t.id)
function ModalityGroupList({ groupings, openId, setOpenId, discountApplied, discountMap, savedOrder }) {
  if (groupings.length === 0) return null;

  return (
    <>
      {groupings.map(mg => {
        const open  = openId === mg.id;
        const total = mg.txns.reduce((a, t) => a + t.price, 0);

        // Collect unique non-zero discount rates for this group's transactions
        const uniqueRates = discountApplied && mg.id !== '__other__'
          ? [...new Set(mg.txns.map(t => discountMap[t.id] || 0))].filter(r => r > 0)
          : [];
        const hasDiscount  = uniqueRates.length > 0;
        const isSplitGroup = uniqueRates.length > 1;
        const discTotal    = hasDiscount
          ? Math.round(mg.txns.reduce((a, t) => a + t.price * (1 - (discountMap[t.id] || 0) / 100), 0))
          : null;

        return (
          <div key={mg.id} className="agg-group" data-open={open}>
            <button className="agg-group-head" onClick={() => setOpenId(open ? null : mg.id)}>
              <I.Chevron size={14} className="chev"/>
              {mg.modality ? <ModChip code={mg.modality}/> : <span style={{width: 6}}/>}
              <div className="code-wrap">
                <div className="code-main">
                  <span style={{fontSize: 13, fontWeight: 600, color: 'var(--ink)'}}>{mg.name}</span>
                </div>
              </div>
              <span className="count-pill">
                <span>{mg.txns.length}</span>
                <span className="lbl">cases</span>
              </span>
              <span className="count-pill">
                {hasDiscount ? (
                  <span className="mono">
                    <span style={{textDecoration: 'line-through', color: 'var(--muted-2)', fontSize: 10.5, marginRight: 4}}>
                      ﷼ {total.toLocaleString()}
                    </span>
                    ﷼ {discTotal.toLocaleString()}
                  </span>
                ) : (
                  <span className="mono">﷼ {total.toLocaleString()}</span>
                )}
              </span>
              {hasDiscount ? (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#047857',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 999, background: 'var(--emerald-50)',
                  border: '1px solid color-mix(in oklab, var(--emerald) 25%, transparent)',
                }}>
                  {isSplitGroup
                    ? uniqueRates.map((r, i) => <span key={i}>{i > 0 ? <span style={{margin: '0 2px', opacity: .5}}>·</span> : ''}-{r}%</span>)
                    : `-${uniqueRates[0]}% off`}
                </span>
              ) : savedOrder ? (
                <span style={{fontSize: 11, fontWeight: 600, color: '#047857', display: 'inline-flex', alignItems: 'center', gap: 4}}>
                  <I.Check size={11}/> Included
                </span>
              ) : (
                <span style={{
                  fontSize: 11, color: 'var(--muted)', padding: '3px 8px', borderRadius: 999,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                }}>Pending</span>
              )}
            </button>

            {open && (
              <div className="agg-group-body">
                <div className="agg-txn-list">
                  {mg.txns.map(t => {
                    const pct = discountMap[t.id] || 0;
                    return (
                      <div key={t.id} className="agg-txn">
                        <span className="t-date">{fmtShortDate(t.date)}</span>
                        <span className="t-id">{t.id}</span>
                        {discountApplied && pct > 0 ? (
                          <span className="t-price mono" style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                            <span style={{textDecoration: 'line-through', color: 'var(--muted-2)', fontSize: 10.5}}>
                              ﷼ {t.price.toLocaleString()}
                            </span>
                            <span style={{color: '#047857', fontWeight: 600}}>
                              ﷼ {Math.round(t.price * (1 - pct / 100)).toLocaleString()}
                            </span>
                            <span style={{fontSize: 10, color: '#047857', background: 'var(--emerald-50)', padding: '1px 5px', borderRadius: 999}}>
                              -{pct}%
                            </span>
                          </span>
                        ) : (
                          <span className="t-price mono">﷼ {t.price.toLocaleString()}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ── View screen (existing order) ──────────────────────────────────────────────
function ServiceOrderV2View({ order, onBack, onToast }) {
  const [openId,          setOpenId]          = useState(null);
  const [items,           setItems]           = useState([]);
  const [loadingItems,    setLoadingItems]    = useState(true);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountMap,     setDiscountMap]     = useState({});  // { txnId: pct }
  const [savingDiscount,  setSavingDiscount]  = useState(false);

  useEffect(() => {
    const filter = encodeURIComponent(`salesOrder_salesOrderId eq '${order.salesOrderId}'`);
    fetch(`/api/SalesOrderItemsV2?$filter=${filter}`)
      .then(r => r.json())
      .then(data => {
        const rows = data.value || [];
        setItems(rows);
        const hasDiscount = rows.some(i => (i.discountPct || 0) > 0);
        if (hasDiscount) {
          const map = {};
          rows.forEach(i => { map[i.transactionId || i.itemId] = i.discountPct || 0; });
          setDiscountMap(map);
          setDiscountApplied(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, [order.salesOrderId]);

  const transactions = useMemo(() =>
    items.map(i => ({
      id: i.transactionId || i.itemId, code: i.examCode,
      en: i.examNameEn, ar: '', mod: modalityFromCode(i.examCode),
      price: i.price, date: new Date(i.transactionDate),
    })),
  [items]);

  const groupings   = useMemo(() => buildModalityGroupings(transactions), [transactions]);
  const totalAmount = useMemo(() => transactions.reduce((a, t) => a + t.price, 0), [transactions]);

  const discountedTotal = useMemo(() => {
    if (!discountApplied) return totalAmount;
    return transactions.reduce((a, t) => a + Math.round(t.price * (1 - (discountMap[t.id] || 0) / 100)), 0);
  }, [transactions, discountApplied, discountMap, totalAmount]);

  // Summary rows for the discount card — computed from live discountMap
  const discountRows = useMemo(() => {
    if (!discountApplied || groupings.length === 0) return [];
    return groupings.filter(mg => mg.id !== '__other__').map(mg => {
      const buckets = new Map();
      mg.txns.forEach(t => {
        const pct = discountMap[t.id] || 0;
        if (!buckets.has(pct)) buckets.set(pct, []);
        buckets.get(pct).push(t);
      });
      const tiers = [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([pct, txns]) => ({
          txns, count: txns.length, pct,
          label: pct === 0 ? 'No Discount' : pct === mg.firstThreshDiscount ? '1st Threshold' : '2nd Threshold',
        }));
      return { id: mg.id, name: mg.name, mod: mg.modality, txns: mg.txns, tiers };
    });
  }, [groupings, discountMap, discountApplied]);

  const handleCalculateDiscount = async () => {
    const { txnMap, summaryRows } = buildGroupDiscountMap(groupings);
    const discTotal = transactions.reduce((a, t) => a + Math.round(t.price * (1 - (txnMap[t.id] || 0) / 100)), 0);

    setSavingDiscount(true);

    // PATCH each item with its per-transaction discount
    const itemById = {};
    items.forEach(i => { itemById[i.transactionId || i.itemId] = i; });

    await Promise.all(transactions.map(t => {
      const i   = itemById[t.id];
      if (!i) return Promise.resolve();
      const pct = txnMap[t.id] || 0;
      return fetch(`/api/SalesOrderItemsV2('${i.itemId}')`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountPct    : pct,
          discountedPrice: Math.round(i.price * (1 - pct / 100)),
        }),
      }).catch(() => {});
    }));

    await fetch(`/api/SalesOrdersV2('${order.salesOrderId}')`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalAmount: discTotal }),
    }).catch(() => {});

    setSavingDiscount(false);
    setDiscountMap(txnMap);
    setDiscountApplied(true);
    onToast('Discount calculated and saved');
  };

  const CopyBtn = ({ value }) => (
    <button
      onClick={() => { navigator.clipboard?.writeText(value); onToast(`Copied ${value}`); }}
      style={{display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 4,
        background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0}}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
    ><I.Copy size={11}/></button>
  );

  return (
    <div className="card">
      <div className="agg-head">
        <button className="btn ghost sm" onClick={onBack}
          style={{display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4}}>
          <I.ChevronLeft size={14}/> Back
        </button>
        <div>
          <h2>
            <I.Clipboard size={15}/> Service Orders V2
            <span style={{fontSize: 11, fontWeight: 500, color: 'var(--muted)',
              padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)'}}>
              {order.month}
            </span>
          </h2>
          <div className="sub">
            {loadingItems ? 'Loading items…' : (
              <>
                {groupings.length} group{groupings.length !== 1 ? 's' : ''} · {transactions.length} cases · ﷼ {totalAmount.toLocaleString()} total
                {discountApplied && (
                  <span style={{marginLeft: 8, color: '#047857', fontWeight: 600}}>
                    → ﷼ {discountedTotal.toLocaleString()} after discount
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="spacer" style={{flex: 1}}/>
        <button
          className="btn sm"
          onClick={handleCalculateDiscount}
          disabled={discountApplied || loadingItems || savingDiscount}
          style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
        >
          {savingDiscount
            ? <><span style={{width:6,height:6,borderRadius:'50%',background:'currentColor',display:'inline-block',opacity:.5}}/> Saving…</>
            : <><I.Zap size={14}/> Calculate Discount</>}
        </button>
      </div>

      {/* ── Order meta ── */}
      <div style={{margin: '12px 12px 0', padding: '12px 16px',
        background: 'color-mix(in oklab, var(--accent) 5%, var(--surface))',
        border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)', borderRadius: 'var(--radius-lg)'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'}}>
          {[
            { label: 'Sales Order ID', val: order.salesOrderId, copy: true },
            { label: 'ERP ID', val: order.erpSalesOrderId || '—', copy: !!order.erpSalesOrderId },
          ].map(f => (
            <div key={f.label} style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 11, color: 'var(--muted)', fontWeight: 500}}>{f.label}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'var(--ink)',
                background:'var(--surface)', padding:'3px 8px', borderRadius:5, border:'1px solid var(--border)'}}>
                {f.val}
              </span>
              {f.copy && <CopyBtn value={f.val}/>}
            </div>
          ))}
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <span style={{fontSize: 11, color: 'var(--muted)', fontWeight: 500}}>Status</span>
            <span className={`status-chip ${order.status === 'submitted' || order.status === 'approved' ? 'finished' : 'in-progress'}`}>
              <span className="dot"/>{order.status}
            </span>
          </div>
        </div>
      </div>

      {discountApplied && discountRows.length > 0 && (
        <DiscountSummaryCard rows={discountRows} totalAmount={totalAmount} discountedTotal={discountedTotal}/>
      )}

      <div className="agg-list" style={{marginTop: 8}}>
        {loadingItems && (
          <div style={{padding: '48px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13}}>Loading items…</div>
        )}
        {!loadingItems && groupings.length === 0 && (
          <div style={{padding: '48px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13}}>
            No items found for this service order.
          </div>
        )}
        <ModalityGroupList
          groupings={groupings} openId={openId} setOpenId={setOpenId}
          discountApplied={discountApplied} discountMap={discountMap} savedOrder={true}
        />
      </div>
    </div>
  );
}

// ── Create screen ─────────────────────────────────────────────────────────────
function ServiceOrderV2Create({ transactions, onBack, onSaved, onToast }) {
  const [openId,          setOpenId]          = useState(null);
  const [saving,          setSaving]          = useState(false);
  const [savedOrder,      setSavedOrder]      = useState(null);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountMap,     setDiscountMap]     = useState({});  // { txnId: pct }

  const monthLabel  = 'May 2026';
  const groupings   = useMemo(() => buildModalityGroupings(transactions), [transactions]);
  const totalAmount = transactions.reduce((a, t) => a + t.price, 0);

  const discountedTotal = useMemo(() => {
    if (!discountApplied) return totalAmount;
    return transactions.reduce((a, t) => a + Math.round(t.price * (1 - (discountMap[t.id] || 0) / 100)), 0);
  }, [transactions, discountApplied, discountMap, totalAmount]);

  // Summary rows for the discount card
  const discountRows = useMemo(() => {
    if (!discountApplied || groupings.length === 0) return [];
    return groupings.filter(mg => mg.id !== '__other__').map(mg => {
      const buckets = new Map();
      mg.txns.forEach(t => {
        const pct = discountMap[t.id] || 0;
        if (!buckets.has(pct)) buckets.set(pct, []);
        buckets.get(pct).push(t);
      });
      const tiers = [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([pct, txns]) => ({
          txns, count: txns.length, pct,
          label: pct === 0 ? 'No Discount' : pct === mg.firstThreshDiscount ? '1st Threshold' : '2nd Threshold',
        }));
      return { id: mg.id, name: mg.name, mod: mg.modality, txns: mg.txns, tiers };
    });
  }, [groupings, discountMap, discountApplied]);

  const handleCalculateDiscount = () => {
    const { txnMap } = buildGroupDiscountMap(groupings);
    setDiscountMap(txnMap);
    setDiscountApplied(true);
    onToast('Discount calculated for May 2026');
  };

  const handleSave = async () => {
    if (saving || savedOrder) return;
    setSaving(true);
    const salesOrderId = `SO2-2026-${String(Math.floor(1000 + Math.random() * 8999))}`;
    const erpId        = `ERP-V2-${String(Math.floor(88000 + Math.random() * 999))}`;
    const finalAmount  = discountApplied ? discountedTotal : totalAmount;

    try {
      await fetch('/api/SalesOrdersV2', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesOrderId, erpSalesOrderId: erpId, month: monthLabel, status: 'draft', totalAmount: finalAmount }),
      });
      await Promise.all(transactions.map(t => {
        const pct = discountMap[t.id] || 0;
        return fetch('/api/SalesOrderItemsV2', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId                 : `${salesOrderId}-${t.id}`,
            salesOrder_salesOrderId: salesOrderId,
            transactionId          : t.id,
            examCode               : t.code,
            examNameEn             : t.en,
            price                  : t.price,
            transactionDate        : t.date.toISOString(),
            discountPct            : pct,
            discountedPrice        : discountApplied ? Math.round(t.price * (1 - pct / 100)) : t.price,
          }),
        }).catch(() => {});
      }));
    } catch (_) {}

    setSaving(false);
    const order = { salesOrderId, erpSalesOrderId: erpId, month: monthLabel, status: 'draft', totalAmount: finalAmount };
    setSavedOrder(order);
    onToast(`Service Order V2 ${salesOrderId} saved`);
    setTimeout(() => onSaved(order), 1400);
  };

  const CopyBtn = ({ value }) => (
    <button
      onClick={() => { navigator.clipboard?.writeText(value); onToast(`Copied ${value}`); }}
      style={{display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 4,
        background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0}}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
    ><I.Copy size={11}/></button>
  );

  return (
    <div className="card">
      <div className="agg-head">
        <button className="btn ghost sm" onClick={onBack}
          style={{display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4}}>
          <I.ChevronLeft size={14}/> Back
        </button>
        <div>
          <h2>
            <I.Clipboard size={15}/> Service Orders V2
            <span style={{fontSize: 11, fontWeight: 500, color: 'var(--muted)',
              padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)'}}>
              {monthLabel}
            </span>
          </h2>
          <div className="sub">
            {groupings.length} group{groupings.length !== 1 ? 's' : ''} · {transactions.length} cases · ﷼ {totalAmount.toLocaleString()} total
            {discountApplied && (
              <span style={{marginLeft: 8, color: '#047857', fontWeight: 600}}>
                → ﷼ {discountedTotal.toLocaleString()} after discount
              </span>
            )}
          </div>
        </div>
        <div className="spacer" style={{flex: 1}}/>
        <button
          className="btn sm"
          onClick={handleCalculateDiscount}
          disabled={discountApplied}
          style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
        >
          <I.Zap size={14}/> Calculate Discount
        </button>
        <button
          className="btn primary sm"
          onClick={handleSave}
          disabled={saving || !!savedOrder}
          style={{display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13}}
        >
          {saving
            ? <><span style={{width:6,height:6,borderRadius:'50%',background:'white',display:'inline-block'}}/> Saving…</>
            : savedOrder
            ? <><I.Check size={14}/> Saved</>
            : <><I.Plus size={14}/> Save</>
          }
        </button>
      </div>

      {discountApplied && discountRows.length > 0 && (
        <DiscountSummaryCard rows={discountRows} totalAmount={totalAmount} discountedTotal={discountedTotal}/>
      )}

      {savedOrder && (
        <div style={{margin: '12px 12px 0', padding: '12px 16px',
          background: 'color-mix(in oklab, var(--emerald) 8%, var(--surface))',
          border: '1px solid color-mix(in oklab, var(--emerald) 30%, transparent)', borderRadius: 'var(--radius-lg)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10}}>
            <span style={{display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#047857'}}>
              <I.Check size={14}/> Service Order V2 Created
            </span>
            <span style={{fontSize: 11, color: 'var(--muted)'}}>
              · {transactions.length} transactions · ﷼ {savedOrder.totalAmount.toLocaleString()}
            </span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'}}>
            {[{ label: 'Sales Order ID', val: savedOrder.salesOrderId }, { label: 'ERP ID', val: savedOrder.erpSalesOrderId }].map(f => (
              <div key={f.label} style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <span style={{fontSize: 11, color: 'var(--muted)', fontWeight: 500}}>{f.label}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'var(--ink)',
                  background:'var(--surface)', padding:'3px 8px', borderRadius:5, border:'1px solid var(--border)'}}>
                  {f.val}
                </span>
                <CopyBtn value={f.val}/>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="agg-list" style={{marginTop: 8}}>
        {groupings.length === 0 && (
          <div style={{padding: '48px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13}}>
            No transactions found for {monthLabel}
          </div>
        )}
        <ModalityGroupList
          groupings={groupings} openId={openId} setOpenId={setOpenId}
          discountApplied={discountApplied} discountMap={discountMap} savedOrder={savedOrder}
        />
      </div>
    </div>
  );
}

Object.assign(window, { AggregationV2 });
