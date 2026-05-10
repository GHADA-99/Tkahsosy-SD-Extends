// Top-level app wiring
function App() {
  const [tweaks, setTweaks] = useState(window.__TWEAKS__);
  const [tweaksVisible, setTweaksVisible] = useState(false);
  const [transactions, setTransactions] = useState(() => buildTransactions(38));

  useEffect(() => {
    fetch('/api/Transactions?$orderby=transactionDate%20desc&$top=100')
      .then(r => r.json())
      .then(data => {
        if (data.value && data.value.length > 0) {
          setTransactions(data.value.map(t => ({
            id  : t.transactionId,
            code: t.examCode,
            en  : t.examNameEn,
            ar  : t.examNameAr,
            mod : t.modality,
            price: t.price,
            date: new Date(t.transactionDate),
          })));
        }
      })
      .catch(() => {});
  }, []);
  const [groups, setGroups] = useState(MODALITY_GROUPS);

  useEffect(() => {
    Promise.all([
      fetch('/api/ModalityGroups').then(r => r.json()),
      fetch('/api/ModalityGroupItems').then(r => r.json()),
    ]).then(([groupsData, itemsData]) => {
      const itemsByGroup = {};
      (itemsData.value || []).forEach(item => {
        const gCode = item.group_groupCode;
        if (!itemsByGroup[gCode]) itemsByGroup[gCode] = [];
        itemsByGroup[gCode].push({ id: item.itemCode, code: item.examCode });
      });
      const fetched = (groupsData.value || []).map(g => ({
        id                 : g.groupCode,
        name               : g.name,
        modality           : g.modality,
        discount           : g.discount,
        qtyOrig            : g.qtyOrig,
        qtyUpdated         : g.qtyUpdated,
        finished           : g.finished,
        firstThreshVol     : g.firstThreshVol,
        firstThreshDiscount: g.firstThreshDiscount,
        secondThreshVol    : g.secondThreshVol,
        secondThreshDiscount: g.secondThreshDiscount,
        items              : itemsByGroup[g.groupCode] || [],
      }));
      if (fetched.length > 0) {
        setGroups(fetched);
        window.MODALITY_GROUPS = fetched;
      }
    }).catch(() => {});
  }, []);
  const [ordersV2Count, setOrdersV2Count] = useState(0);

  useEffect(() => {
    fetch('/api/SalesOrdersV2?$count=true&$top=0')
      .then(r => r.json())
      .then(data => { if (typeof data['@odata.count'] === 'number') setOrdersV2Count(data['@odata.count']); })
      .catch(() => {});
  }, []);
  const [nav, setNav] = useState('dashboard');
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState({ q: '', mod: 'all', range: 'all' });
  const [newCount, setNewCount] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const handleExport = useCallback(async () => {
    if (tab === 'groups') {
      const groupRows = groups.map(g => ({
        'Group Code'            : g.id.toUpperCase(),
        'Name'                  : g.name,
        'Modality'              : g.modality,
        'Discount (%)'          : g.discount,
        'Original Qty'          : g.qtyOrig,
        'Updated Qty'           : g.qtyUpdated,
        'Completion (%)'        : Math.min(100, Math.round((g.qtyUpdated / g.qtyOrig) * 100)),
        'Status'                : g.finished ? 'Finished' : 'In Progress',
        '1st Threshold Vol'     : g.firstThreshVol,
        '1st Threshold Disc (%)': g.firstThreshDiscount,
        '2nd Threshold Vol'     : g.secondThreshVol,
        '2nd Threshold Disc (%)': g.secondThreshDiscount,
      }));
      const itemRows = groups.flatMap(g =>
        g.items.map(item => ({
          'Group Code' : g.id.toUpperCase(),
          'Group Name' : g.name,
          'Modality'   : g.modality,
          'Modality ID': item.id,
          'Exam Code'  : item.code,
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groupRows), 'Modality Groups');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows),  'Modality Items');
      XLSX.writeFile(wb, 'modality-groups.xlsx');
      showToast('Excel file exported');

    } else if (tab === 'monthly') {
      try {
        const [ordersRes, itemsRes] = await Promise.all([
          fetch('/api/SalesOrders'),
          fetch('/api/SalesOrderItems'),
        ]);
        const ordersData = await ordersRes.json();
        const itemsData  = await itemsRes.json();

        const orderRows = (ordersData.value || []).map(o => ({
          'Sales Order ID'    : o.salesOrderId,
          'ERP Sales Order ID': o.erpSalesOrderId,
          'Month'             : o.month,
          'Status'            : o.status,
          'Total Amount (SAR)': o.totalAmount,
        }));

        const itemRows = (itemsData.value || []).map(i => ({
          'Item ID'           : i.itemId,
          'Sales Order ID'    : i.salesOrder_salesOrderId,
          'Transaction ID'    : i.transactionId,
          'Exam Code'         : i.examCode,
          'Exam Name'         : i.examNameEn,
          'Price (SAR)'       : i.price,
          'Transaction Date'  : i.transactionDate ? i.transactionDate.replace('T', ' ').replace('Z', '') : '',
        }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows.length ? orderRows : [{}]), 'Sales Orders');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows.length  ? itemRows  : [{}]), 'Sales Order Items');
        XLSX.writeFile(wb, 'sales-orders.xlsx');
        showToast('Sales orders exported');
      } catch (_) {
        showToast('Export failed');
      }
    }
  }, [tab, groups, showToast]);

  // Tweaks-mode wiring
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksVisible(true);
      else if (e.data?.type === '__deactivate_edit_mode') setTweaksVisible(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Apply dark/accent to root
  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.dark ? 'dark' : 'light';
    document.documentElement.dataset.accent = tweaks.accent;
  }, [tweaks.dark, tweaks.accent]);

  // Simulated live sync — pushes a new transaction every ~7s
  useEffect(() => {
    if (!tweaks.liveSync) return;
    let idx = 0;
    const tick = () => {
      const nt = newTransactionAt(new Date(2026, 3, 22, 14, 12 + idx), idx);
      idx++;
      setTransactions(prev => [nt, ...prev.map(p => ({...p, isNew: false}))]);
      setNewCount(c => c + 1);
      // Clear isNew flag so animation only fires once
      setTimeout(() => {
        setTransactions(prev => prev.map(p => p.id === nt.id ? {...p, isNew: false} : p));
      }, 2500);
    };
    const t = setInterval(tick, 7000);
    return () => clearInterval(t);
  }, [tweaks.liveSync]);

  const counts = {
    tx: transactions.length,
    groups: groups.length,
    orders: 12,
    ordersV2: ordersV2Count,
  };

  const mainClass = "main" + (tweaks.density === 'compact' ? ' compact' : '');

  return (
    <div className="app">
      <TopBar
        notifCount={newCount}
        onToggleTheme={() => {
          const d = !tweaks.dark;
          setTweaks(t => ({...t, dark: d}));
          window.parent.postMessage({ type: '__edit_mode_set_keys', edits: {dark: d} }, '*');
        }}
        dark={tweaks.dark}/>
      <Sidebar current={nav} onNav={(id) => {
          setNav(id);
          setNewCount(0);
          const navToTab = { dashboard: 'all', transactions: 'feed', groups: 'groups', orders: 'monthly', ordersV2: 'ordersV2', reports: 'reports' };
          if (navToTab[id]) setTab(navToTab[id]);
        }} counts={counts}/>

      <div className={mainClass}>
        {tab !== 'feed' && tab !== 'reports' && tab !== 'ordersV2' && (
          <PageHeader
            title="Radiology Operations"
            subtitle="Live from PACS-Gateway · Central Imaging Dept · Apr 22, 2026"
            tab={tab} onTab={setTab}
            notifCount={newCount}
            liveCount={tab === 'feed' ? 0 : newCount}
            onExport={handleExport}
            onCalculateDiscount={() => showToast('Discount calculated')}/>
        )}

        {tab !== 'groups' && tab !== 'feed' && tab !== 'monthly' && tab !== 'reports' && tab !== 'ordersV2' && <KpiStrip tx={transactions} groups={groups}/>}

        {tab === 'reports' && <div style={{flex: 1}}/>}

        {tab === 'ordersV2' && (
          <AggregationV2 onToast={showToast} onOrderSaved={() => setOrdersV2Count(c => c + 1)} onOrderDeleted={() => setOrdersV2Count(c => c - 1)}/>
        )}

        {(tab === 'all' || tab === 'feed') && (
          <div style={{marginBottom: tab === 'all' ? 16 : 0}}>
            <TransactionFeed
              transactions={transactions}
              filters={filters} setFilters={setFilters}
              liveSync={tweaks.liveSync}
              showArabic={tweaks.showArabic}
              onImport={(newTxs) => setTransactions(prev => [...newTxs, ...prev])}
              onToast={showToast}/>
          </div>
        )}

        {(tab === 'all' || tab === 'groups' || tab === 'monthly') && (
          <div className={tab === 'all' ? 'panels' : ''} style={tab === 'all' ? {} : {}}>
            {(tab === 'all' || tab === 'monthly') && (
              <Aggregation transactions={transactions} onToast={showToast} readOnly={tab === 'all'} groups={groups} onUpdateGroup={(g) => setGroups(gs => gs.map(x => x.id === g.id ? g : x))}/>
            )}
            {(tab === 'all' || tab === 'groups') && (
              <div style={tab === 'all' ? {} : {marginTop: 0}}>
                <ModalityGroups groups={groups} setGroups={setGroups} readOnly={tab === 'all' || tab === 'groups'}/>
              </div>
            )}
          </div>
        )}
      </div>

      <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} visible={tweaksVisible}/>

      {toast && (
        <div className="toast"><I.Check size={13}/> {toast}</div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
