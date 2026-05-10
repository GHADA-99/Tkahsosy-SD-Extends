// Seed data for MedSync

const MODALITIES = [
  { code: 'CT',  label: 'CT Scan',    full: 'Computed Tomography' },
  { code: 'MRI', label: 'MRI',        full: 'Magnetic Resonance Imaging' },
  { code: 'XR',  label: 'X-Ray',      full: 'Radiography' },
  { code: 'US',  label: 'Ultrasound', full: 'Ultrasonography' },
];

const EXAM_SEED = [
  { code: 'CT-CHEST-C',   en: 'CT Chest with Contrast',        ar: 'أشعة مقطعية للصدر مع صبغة',     mod: 'CT',  price: 850 },
  { code: 'CT-ABD-NC',    en: 'CT Abdomen without Contrast',   ar: 'أشعة مقطعية للبطن بدون صبغة',   mod: 'CT',  price: 720 },
  { code: 'CT-HEAD-NC',   en: 'CT Brain without Contrast',     ar: 'أشعة مقطعية للدماغ بدون صبغة',  mod: 'CT',  price: 650 },
  { code: 'CT-SPINE-L',   en: 'CT Lumbar Spine',               ar: 'أشعة مقطعية للفقرات القطنية',   mod: 'CT',  price: 690 },
  { code: 'MRI-BRAIN-C',  en: 'MRI Brain with Contrast',       ar: 'رنين مغناطيسي للدماغ مع صبغة',  mod: 'MRI', price: 1450 },
  { code: 'MRI-KNEE-R',   en: 'MRI Right Knee',                ar: 'رنين مغناطيسي للركبة اليمنى',   mod: 'MRI', price: 1200 },
  { code: 'MRI-SPINE-C',  en: 'MRI Cervical Spine',            ar: 'رنين مغناطيسي للفقرات العنقية', mod: 'MRI', price: 1320 },
  { code: 'MRI-ABD-C',    en: 'MRI Abdomen with Contrast',     ar: 'رنين مغناطيسي للبطن مع صبغة',   mod: 'MRI', price: 1580 },
  { code: 'XR-CHEST-PA',  en: 'Chest X-Ray PA View',           ar: 'أشعة سينية للصدر أمامي',        mod: 'XR',  price: 120 },
  { code: 'XR-KNEE-AP',   en: 'Knee X-Ray AP & Lateral',       ar: 'أشعة سينية للركبة أمامي وجانبي', mod: 'XR',  price: 140 },
  { code: 'XR-HAND-R',    en: 'Right Hand X-Ray',              ar: 'أشعة سينية لليد اليمنى',        mod: 'XR',  price: 110 },
  { code: 'US-ABD-FULL',  en: 'Abdominal Ultrasound',          ar: 'سونار للبطن الكامل',            mod: 'US',  price: 280 },
  { code: 'US-PELVIC-T',  en: 'Transvaginal Ultrasound',       ar: 'سونار عبر المهبل',              mod: 'US',  price: 320 },
  { code: 'US-THYR',      en: 'Thyroid Ultrasound',            ar: 'سونار الغدة الدرقية',           mod: 'US',  price: 240 },
  { code: 'PET-ONCO',     en: 'PET/CT Oncology Scan',          ar: 'مسح بت/سي تي للأورام',          mod: 'PET', price: 3200 },
  { code: 'NM-BONE',      en: 'Nuclear Bone Scan',             ar: 'مسح ذري للعظام',                mod: 'NM',  price: 880 },
  { code: 'MG-BILAT',     en: 'Bilateral Mammography',         ar: 'أشعة الثدي الثنائية',           mod: 'MG',  price: 420 },
];

// Build a deterministic initial backlog of transactions
function seedRand(i) { const x = Math.sin(i * 9301 + 49297) * 233280; return x - Math.floor(x); }

function buildTransactions(count = 38) {
  const now = new Date(2026, 3, 22, 14, 12); // April 22 2026 14:12
  const rows = [];
  for (let i = 0; i < count; i++) {
    const exam = EXAM_SEED[Math.floor(seedRand(i) * EXAM_SEED.length)];
    const minutesAgo = Math.floor(seedRand(i + 101) * 60 * 20); // up to ~13h
    const d = new Date(now.getTime() - minutesAgo * 60 * 1000);
    rows.push({
      id: `TX-${String(84210 - i).padStart(5, '0')}`,
      ...exam,
      price: exam.price + Math.floor(seedRand(i + 7) * 50 - 25),
      date: d,
    });
  }
  return rows.sort((a, b) => b.date - a.date);
}

function newTransactionAt(date, idx) {
  const exam = EXAM_SEED[Math.floor(seedRand(idx + 77) * EXAM_SEED.length)];
  return {
    id: `TX-${String(84250 + idx).padStart(5, '0')}`,
    ...exam,
    price: exam.price + Math.floor(seedRand(idx + 31) * 50 - 25),
    date,
    isNew: true,
  };
}

const MODALITY_GROUPS = [
  {
    id: 'mg-ct-q2', name: 'CT Scans — Q2 Contract', modality: 'CT', discount: 18, qtyOrig: 240, qtyUpdated: 214, finished: false,
    firstThreshVol: 3, firstThreshDiscount: 50, secondThreshVol: 160, secondThreshDiscount: 18,
    items: [
      { id: 'MI-CT-01', code: 'CT-CHEST-C' },
      { id: 'MI-CT-02', code: 'CT-ABD-NC'  },
      { id: 'MI-CT-03', code: 'CT-HEAD-NC' },
      { id: 'MI-CT-04', code: 'CT-SPINE-L' },
    ],
  },
  {
    id: 'mg-mri-prem', name: 'MRI Premium Bundle', modality: 'MRI', discount: 25, qtyOrig: 120, qtyUpdated: 120, finished: true,
    firstThreshVol: 4, firstThreshDiscount: 50, secondThreshVol: 8, secondThreshDiscount: 75,
    items: [
      { id: 'MI-MRI-01', code: 'MRI-BRAIN-C' },
      { id: 'MI-MRI-02', code: 'MRI-KNEE-R'  },
      { id: 'MI-MRI-03', code: 'MRI-SPINE-C' },
      { id: 'MI-MRI-04', code: 'MRI-ABD-C'   },
    ],
  },
  {
    id: 'mg-xr-out', name: 'X-Ray Outpatient Block', modality: 'XR', discount: 12, qtyOrig: 500, qtyUpdated: 378, finished: false,
    firstThreshVol: 3, firstThreshDiscount: 50, secondThreshVol: 300, secondThreshDiscount: 12,
    items: [
      { id: 'MI-XR-01', code: 'XR-CHEST-PA' },
      { id: 'MI-XR-02', code: 'XR-KNEE-AP'  },
      { id: 'MI-XR-03', code: 'XR-HAND-R'   },
    ],
  },
  {
    id: 'mg-us-womens', name: "Ultrasound — Women's Health", modality: 'US', discount: 15, qtyOrig: 180, qtyUpdated: 142, finished: false,
    firstThreshVol: 4, firstThreshDiscount: 50, secondThreshVol: 100, secondThreshDiscount: 15,
    items: [
      { id: 'MI-US-01', code: 'US-ABD-FULL' },
      { id: 'MI-US-02', code: 'US-PELVIC-T' },
      { id: 'MI-US-03', code: 'US-THYR'     },
    ],
  },
];

function buildMay2026Transactions(count = 28) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const exam = EXAM_SEED[Math.floor(seedRand(i + 200) * EXAM_SEED.length)];
    const day  = Math.floor(seedRand(i + 300) * 28) + 1;
    const hour = Math.floor(seedRand(i + 400) * 14) + 7;
    const d    = new Date(2026, 4, day, hour, 0); // May 2026 (month index 4)
    rows.push({
      id   : `TX-M5${String(10000 + i).padStart(5, '0')}`,
      ...exam,
      price: exam.price + Math.floor(seedRand(i + 500) * 50 - 25),
      date : d,
    });
  }
  return rows.sort((a, b) => b.date - a.date);
}

window.MODALITIES = MODALITIES;
window.EXAM_SEED = EXAM_SEED;
window.buildTransactions = buildTransactions;
window.newTransactionAt = newTransactionAt;
window.buildMay2026Transactions = buildMay2026Transactions;
window.MODALITY_GROUPS = MODALITY_GROUPS;
