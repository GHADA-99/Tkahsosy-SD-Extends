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
            id         : t.transactionId,
            code       : t.serviceMaterial,
            en         : t.examNameEn,
            ar         : t.examNameAr,
            mod        : t.modality,
            price      : t.price,
            date       : new Date(t.transactionDate),
            otherNmType: t.otherNmType,
            salesOffice   : t.salesOffice,
            cost          : t.cost,
            discount      : t.discount,
            radiologist   : t.radiologist,
            room          : t.room,
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
      fetch('/api/ModalityServiceTypes').then(r => r.json()),
    ]).then(([groupsData, itemsData, stData]) => {
      const stByItem = {};
      (stData.value || []).forEach(st => {
        const iCode = st.item_itemCode;
        if (!stByItem[iCode]) stByItem[iCode] = [];
        stByItem[iCode].push({ id: st.serviceTypeCode, name: st.name });
      });
      const itemsByGroup = {};
      (itemsData.value || []).forEach(item => {
        const gCode = item.group_groupCode;
        if (!itemsByGroup[gCode]) itemsByGroup[gCode] = [];
        itemsByGroup[gCode].push({
          id           : item.itemCode,
          serviceTypes : stByItem[item.itemCode] || [],
        });
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

  const [materialsCount, setMaterialsCount] = useState(0);

  useEffect(() => {
    fetch('/api/Materials?$count=true&$top=0')
      .then(r => r.json())
      .then(data => { if (typeof data['@odata.count'] === 'number') setMaterialsCount(data['@odata.count']); })
      .catch(() => {});
  }, []);

  const [doctorsCount, setDoctorsCount] = useState(0);

  useEffect(() => {
    fetch('/api/Doctors?$count=true&$top=0')
      .then(r => r.json())
      .then(data => { if (typeof data['@odata.count'] === 'number') setDoctorsCount(data['@odata.count']); })
      .catch(() => {});
  }, []);
  const importFileRef   = useRef(null);
  const smImportFileRef = useRef(null);
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
        'Status'                : g.finished ? 'Finished' : '',
        '1st Threshold Vol'     : g.firstThreshVol,
        '1st Threshold Disc (%)': g.firstThreshDiscount,
        '2nd Threshold Vol'     : g.secondThreshVol,
        '2nd Threshold Disc (%)': g.secondThreshDiscount,
      }));
      const itemRows = groups.flatMap(g =>
        g.items.map(item => ({
          'Group Code'     : g.id.toUpperCase(),
          'Group Name'     : g.name,
          'Modality'       : g.modality,
          'Modality ID'    : item.id,
          'Exam Code'      : item.id,
          'Service Types #': (item.serviceTypes || []).length,
        }))
      );
      const serviceTypeRows = groups.flatMap(g =>
        g.items.flatMap(item =>
          (item.serviceTypes || []).map(st => ({
            'Group Code'       : g.id.toUpperCase(),
            'Group Name'       : g.name,
            'Modality'         : g.modality,
            'Modality ID'      : item.id,
            'Exam Code'        : item.id,
            'Service Type Code': st.id,
            'Service Type Name': st.name,
          }))
        )
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groupRows),                                         'Modality Groups');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows),                                          'Modality Items');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(serviceTypeRows.length ? serviceTypeRows : [{}]),    'Service Types');
      XLSX.writeFile(wb, 'modality-groups.xlsx');
      showToast('Excel file exported');
    }
  }, [tab, groups, showToast]);

  const handleImport = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });

        const groupSheet = wb.Sheets['Modality Groups'];
        const itemSheet  = wb.Sheets['Modality Items'];
        // Accept V2 "Service Types" sheet OR legacy "Service Materials" sheet
        const stSheet    = wb.Sheets['Service Types'] || wb.Sheets['Service Materials'];

        if (!groupSheet) { showToast('Invalid file: missing "Modality Groups" sheet'); return; }

        const groupRows = XLSX.utils.sheet_to_json(groupSheet);
        const itemRows  = itemSheet ? XLSX.utils.sheet_to_json(itemSheet)  : [];
        const stRows    = stSheet   ? XLSX.utils.sheet_to_json(stSheet)    : [];

        // Build sets of existing keys so we know PATCH vs POST
        const existingGroupIds = new Set(groups.map(g => g.id));
        const existingItemIds  = new Set(groups.flatMap(g => g.items.map(i => i.id)));
        const existingStIds    = new Set(groups.flatMap(g => g.items.flatMap(i => (i.serviceTypes || []).map(st => st.id))));

        const hdrs = { 'Content-Type': 'application/json' };
        let failedGroups = 0, failedItems = 0, failedSt = 0;

        // Upsert groups sequentially to respect FK order
        for (const row of groupRows) {
          const code = String(row['Group Code'] || '').toLowerCase().trim();
          if (!code) continue;
          const body = {
            groupCode            : code,
            name                 : String(row['Name']                    || '').trim(),
            modality             : String(row['Modality']                || '').trim(),
            discount             : Number(row['Discount (%)']            || 0),
            qtyOrig              : Number(row['Original Qty']            || 0),
            qtyUpdated           : Number(row['Updated Qty']             || 0),
            finished             : row['Status'] === 'Finished',
            firstThreshVol       : Number(row['1st Threshold Vol']       || 0),
            firstThreshDiscount  : Number(row['1st Threshold Disc (%)']  || 0),
            secondThreshVol      : Number(row['2nd Threshold Vol']       || 0),
            secondThreshDiscount : Number(row['2nd Threshold Disc (%)']  || 0),
          };
          const res = existingGroupIds.has(code)
            ? await fetch(`/api/ModalityGroups('${code}')`, { method: 'PATCH', headers: hdrs, body: JSON.stringify(body) })
            : await fetch('/api/ModalityGroups',             { method: 'POST',  headers: hdrs, body: JSON.stringify(body) });
          if (!res.ok) failedGroups++;
        }

        // Upsert items
        for (const row of itemRows) {
          const itemCode  = String(row['Modality ID']  || '').trim();
          const groupCode = String(row['Group Code']   || '').toLowerCase().trim();
          if (!itemCode || !groupCode) continue;
          const body = { itemCode, group_groupCode: groupCode };
          const res = existingItemIds.has(itemCode)
            ? await fetch(`/api/ModalityGroupItems('${itemCode}')`, { method: 'PATCH', headers: hdrs, body: JSON.stringify(body) })
            : await fetch('/api/ModalityGroupItems',                 { method: 'POST',  headers: hdrs, body: JSON.stringify(body) });
          if (!res.ok) failedItems++;
        }

        // Upsert service types — accept V2 columns (Service Type Code/Name) or legacy (Service Material Code/Name)
        for (const row of stRows) {
          const stCode   = String(row['Service Type Code']  || row['Service Material Code'] || '').trim();
          const itemCode = String(row['Modality ID']        || '').trim();
          const name     = String(row['Service Type Name']  || row['Service Material Name'] || '').trim();
          if (!stCode || !itemCode) continue;
          const body = { serviceTypeCode: stCode, item_itemCode: itemCode, name };
          const res = existingStIds.has(stCode)
            ? await fetch(`/api/ModalityServiceTypes('${encodeURIComponent(stCode)}')`, { method: 'PATCH', headers: hdrs, body: JSON.stringify(body) })
            : await fetch('/api/ModalityServiceTypes',                                   { method: 'POST',  headers: hdrs, body: JSON.stringify(body) });
          if (!res.ok) failedSt++;
        }

        // Refetch and rebuild state
        const [gData, iData, sData] = await Promise.all([
          fetch('/api/ModalityGroups').then(r => r.json()),
          fetch('/api/ModalityGroupItems').then(r => r.json()),
          fetch('/api/ModalityServiceTypes').then(r => r.json()),
        ]);
        const stByItem = {};
        (sData.value || []).forEach(st => {
          if (!stByItem[st.item_itemCode]) stByItem[st.item_itemCode] = [];
          stByItem[st.item_itemCode].push({ id: st.serviceTypeCode, name: st.name });
        });
        const itemsByGroup = {};
        (iData.value || []).forEach(item => {
          if (!itemsByGroup[item.group_groupCode]) itemsByGroup[item.group_groupCode] = [];
          itemsByGroup[item.group_groupCode].push({
            id: item.itemCode,
            serviceTypes: stByItem[item.itemCode] || [],
          });
        });
        const fetched = (gData.value || []).map(g => ({
          id: g.groupCode, name: g.name, modality: g.modality,
          discount: g.discount, qtyOrig: g.qtyOrig, qtyUpdated: g.qtyUpdated,
          finished: g.finished,
          firstThreshVol: g.firstThreshVol, firstThreshDiscount: g.firstThreshDiscount,
          secondThreshVol: g.secondThreshVol, secondThreshDiscount: g.secondThreshDiscount,
          items: itemsByGroup[g.groupCode] || [],
        }));
        setGroups(fetched);
        window.MODALITY_GROUPS = fetched;
        const totalFailed = failedGroups + failedItems + failedSt;
        if (totalFailed > 0) {
          showToast(`Import done — ${totalFailed} row${totalFailed !== 1 ? 's' : ''} failed to save`);
        } else {
          showToast(`Imported ${groupRows.length} group${groupRows.length !== 1 ? 's' : ''}, ${itemRows.length} item${itemRows.length !== 1 ? 's' : ''}, ${stRows.length} service type${stRows.length !== 1 ? 's' : ''}`);
        }
      } catch (err) {
        console.error(err);
        showToast('Import failed — check file format');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [groups, showToast]);

  const handleSMExport = useCallback(() => {
    const rows = groups.flatMap(g =>
      g.items.flatMap(item =>
        (item.serviceTypes || []).map(st => ({
          'Group Code'       : g.id.toUpperCase(),
          'Modality'         : g.modality,
          'Modality ID'      : item.id,
          'Exam Code'        : item.id,
          'Service Type Code': st.id,
          'Service Type Name': st.name,
        }))
      )
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'Service Types');
    XLSX.writeFile(wb, 'service-types.xlsx');
    showToast('Service types exported');
  }, [groups, showToast]);

  const handleSMImport = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        // Accept V2 "Service Types" sheet or legacy "Service Materials" sheet
        const sheet = wb.Sheets['Service Types'] || wb.Sheets['Service Materials'];
        if (!sheet) { showToast('Invalid file: missing "Service Types" sheet'); return; }

        const rows = XLSX.utils.sheet_to_json(sheet);
        const existingStIds = new Set(
          groups.flatMap(g => g.items.flatMap(i => (i.serviceTypes || []).map(st => st.id)))
        );
        const hdrs = { 'Content-Type': 'application/json' };
        let failed = 0;

        for (const row of rows) {
          const stCode   = String(row['Service Type Code']  || row['Service Material Code'] || '').trim();
          const itemCode = String(row['Modality ID']        || '').trim();
          const name     = String(row['Service Type Name']  || row['Service Material Name'] || row['Name'] || '').trim();
          if (!stCode || !itemCode) continue;
          const body = { serviceTypeCode: stCode, item_itemCode: itemCode, name };
          const res = existingStIds.has(stCode)
            ? await fetch(`/api/ModalityServiceTypes('${encodeURIComponent(stCode)}')`, { method: 'PATCH', headers: hdrs, body: JSON.stringify(body) })
            : await fetch('/api/ModalityServiceTypes',                                   { method: 'POST',  headers: hdrs, body: JSON.stringify(body) });
          if (!res.ok) failed++;
        }

        // Refetch and rebuild
        const [gData, iData, sData] = await Promise.all([
          fetch('/api/ModalityGroups').then(r => r.json()),
          fetch('/api/ModalityGroupItems').then(r => r.json()),
          fetch('/api/ModalityServiceTypes').then(r => r.json()),
        ]);
        const stByItem = {};
        (sData.value || []).forEach(st => {
          if (!stByItem[st.item_itemCode]) stByItem[st.item_itemCode] = [];
          stByItem[st.item_itemCode].push({ id: st.serviceTypeCode, name: st.name });
        });
        const itemsByGroup = {};
        (iData.value || []).forEach(item => {
          if (!itemsByGroup[item.group_groupCode]) itemsByGroup[item.group_groupCode] = [];
          itemsByGroup[item.group_groupCode].push({ id: item.itemCode, serviceTypes: stByItem[item.itemCode] || [] });
        });
        const fetched = (gData.value || []).map(g => ({
          id: g.groupCode, name: g.name, modality: g.modality,
          discount: g.discount, qtyOrig: g.qtyOrig, qtyUpdated: g.qtyUpdated,
          finished: g.finished,
          firstThreshVol: g.firstThreshVol, firstThreshDiscount: g.firstThreshDiscount,
          secondThreshVol: g.secondThreshVol, secondThreshDiscount: g.secondThreshDiscount,
          items: itemsByGroup[g.groupCode] || [],
        }));
        setGroups(fetched);
        window.MODALITY_GROUPS = fetched;
        if (failed > 0) showToast(`Import done — ${failed} row${failed !== 1 ? 's' : ''} failed`);
        else showToast(`Imported ${rows.length} service type${rows.length !== 1 ? 's' : ''}`);
      } catch (err) {
        console.error(err);
        showToast('Import failed — check file format');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [groups, setGroups, showToast]);

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
    ordersV2: ordersV2Count,
    materials: materialsCount || undefined,
    doctors: doctorsCount || undefined,
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
          const navToTab = { dashboard: 'all', doctors: 'doctors', transactions: 'feed', groups: 'groups', ordersV2: 'ordersV2', materials: 'materials', reports: 'reports' };
          if (navToTab[id]) setTab(navToTab[id]);
        }} counts={counts}/>

      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls"
        style={{display: 'none'}}
        onChange={handleImport}/>
      <input
        ref={smImportFileRef}
        type="file"
        accept=".xlsx,.xls"
        style={{display: 'none'}}
        onChange={handleSMImport}/>

      <div className={mainClass}>
        {tab !== 'feed' && tab !== 'reports' && tab !== 'ordersV2' && tab !== 'materials' && tab !== 'doctors' && (
          <PageHeader
            title="Radiology Operations"
            subtitle="Live from PACS-Gateway · Central Imaging Dept · Apr 22, 2026"
            tab={tab} onTab={setTab}
            notifCount={newCount}
            liveCount={tab === 'feed' ? 0 : newCount}
            onExport={handleExport}
            onImport={tab === 'groups' ? () => importFileRef.current?.click() : undefined}/>
        )}

        {tab !== 'groups' && tab !== 'feed' && tab !== 'reports' && tab !== 'ordersV2' && tab !== 'materials' && tab !== 'doctors' && <KpiStrip tx={transactions} groups={groups}/>}

        {tab === 'reports' && <div style={{flex: 1}}/>}

        {tab === 'ordersV2' && (
          <AggregationV2 onToast={showToast} onOrderSaved={() => setOrdersV2Count(c => c + 1)} onOrderDeleted={() => setOrdersV2Count(c => c - 1)}/>
        )}

        {tab === 'materials' && <Materials onToast={showToast}/>}
        {tab === 'doctors'   && <Doctors onToast={showToast}/>}

        {(tab === 'all' || tab === 'feed') && (
          <div style={{marginBottom: tab === 'all' ? 16 : 0}}>
            <TransactionFeed
              transactions={transactions}
              filters={filters} setFilters={setFilters}
              liveSync={tweaks.liveSync}
              showArabic={tweaks.showArabic}
              onImport={(newTxs) => setTransactions(prev => [...newTxs, ...prev])}
              onDelete={(ids) => setTransactions(prev => prev.filter(t => !ids.has(t.id)))}
              onToast={showToast}/>
          </div>
        )}

        {tab === 'groups' && (
          <ModalityGroups
            groups={groups} setGroups={setGroups}
            readOnly={tab === 'all' || tab === 'groups'}
            onToast={showToast}
            onSMExport={handleSMExport}
            onSMImport={() => smImportFileRef.current?.click()}/>
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
