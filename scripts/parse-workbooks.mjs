import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data', 'source');

// Cells in these sheets are a mix of literals, shared formulas
// ({formula,result} / {sharedFormula,result}) and rich text. Unwrap to the
// underlying value — reading a formula cell as a string yields
// "[object Object]" and silently drops the row.
const raw = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return raw(v.result);
    if ('text' in v) return raw(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  }
  return String(v);
};
const clean = (v) => raw(v).replace(/\s+/g, ' ').trim();
const num = (v) => {
  const n = parseInt(clean(v).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

// Hindi labels are authoritative (they're what drivers read on the paper
// form). English is added alongside so the dashboard and audit exports are
// readable by management.
const EN = {
  'कागजात': 'Documents',
  'फायर एक्सटीन्गुइशेर': 'Fire Extinguisher',
  'फर्स्ट ऐड बॉक्स': 'First Aid Box',
  'दरवाजा': 'Door',
  'हैंड लाइट': 'Hand Light',
  'हॉर्न': 'Horn',
  'ब्रेक': 'Brake',
  'रियर व्यू मिरर': 'Rear View Mirror',
  'वाइपर': 'Wiper',
  'सीट बेल्ट': 'Seat Belt',
  'फुट ब्रेक': 'Foot Brake',
  'हैण्ड ब्रेक': 'Hand Brake',
  'सेल्फ स्टार्टर': 'Self Starter',
  'वाडी लाइट': 'Body Light',
  'साइड इंडिकेटर': 'Side Indicator',
  'ब्रेक लाइट': 'Brake Light',
  'बैक हॉर्न': 'Reverse Horn',
  'बैक लाइट': 'Reverse Light',
  'टायर कंडीशन': 'Tyre Condition',
  'स्टेपनी': 'Spare Tyre',
  'टार्च': 'Torch',
  'रिप्लेक्टर': 'Reflector',
  'अन्य': 'Other',
};

// Hindi for the 17 first-aid kit items (source sheet is English-only).
const ITEM_HI = {
  'STERILE COMBINE DRESSING PAD': 'स्टेराइल कंबाइन ड्रेसिंग पैड',
  'STERIL EYE PAD': 'स्टेराइल आई पैड',
  'STERIL COTTON ROLL': 'स्टेराइल कॉटन रोल',
  'JELONET GAUZE DRESSING': 'जेलोनेट गॉज ड्रेसिंग',
  'POVIDONE SOLUTION 10% W/V': 'पोविडोन सॉल्यूशन 10%',
  'ANTISEPTIC SOL ( SAVLON)': 'एंटीसेप्टिक सॉल्यूशन (सैवलॉन)',
  'MERCUROCHROME SOLUTION 2% W/V': 'मर्क्यूरोक्रोम सॉल्यूशन 2%',
  'TAB. ANALGESIC': 'दर्द निवारक टैबलेट',
  'EYE WASH CUP': 'आई वॉश कप',
  'ROLL OF ADHESIVE TAPE': 'चिपकने वाला टेप',
  'POTASSIUM PERMANGANATE': 'पोटैशियम परमैंगनेट',
  'ANTISEPTIC OINTMENT': 'एंटीसेप्टिक मरहम',
  'SILVER NITRATE OINTMENT': 'सिल्वर नाइट्रेट मरहम',
  'BANDAGE': 'पट्टी',
  'HANDIPLAST': 'हैंडीप्लास्ट',
  'FIRST AID LEAFLET': 'फर्स्ट एड पर्चा',
};

async function loadWb(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(SRC, file));
  return wb;
}

export async function parseWorkbooks() {
  // ---------------------------------------------------------------
  // 1. FIRST AID — kit items (Sheet1) and box locations (Sheet2)
  // ---------------------------------------------------------------
  const faWb = await loadWb('first-aid-list.xlsx');
  const s1 = faWb.worksheets[0];
  const s2 = faWb.worksheets[1];

  const items = [];
  for (let r = 3; r <= 19; r++) {
    const row = s1.getRow(r);
    const name = clean(row.getCell('B').value);
    if (!name) continue;
    items.push({
      sr: num(row.getCell('A').value) ?? items.length + 1,
      name,
      spec: clean(row.getCell('C').value) === '/' ? '' : clean(row.getCell('C').value),
      qty: num(row.getCell('D').value) ?? 1,
    });
  }

  const boxes = [];
  const staffSeen = new Map(); // name -> mobile counts
  for (let r = 3; r <= 43; r++) {
    const row = s2.getRow(r);
    const boxNo = num(row.getCell('B').value);
    const loc = clean(row.getCell('C').value);
    if (boxNo === null || !loc) continue;
    const aider = clean(row.getCell('D').value);
    const mobile = clean(row.getCell('E').value).replace(/\D/g, '');
    boxes.push({ boxNo, loc, aider });
    if (aider) {
      if (!staffSeen.has(aider)) staffSeen.set(aider, new Map());
      if (mobile) {
        const m = staffSeen.get(aider);
        m.set(mobile, (m.get(mobile) || 0) + 1);
      }
    }
  }
  // One person appears against several boxes, sometimes with a mistyped
  // mobile. Keep the number that appears most often for that name.
  const staff = [...staffSeen.entries()].map(([name, mobiles]) => {
    const best = [...mobiles.entries()].sort((a, b) => b[1] - a[1])[0];
    return { name, mobile: best ? best[0] : null, variants: mobiles.size };
  });

  // ---------------------------------------------------------------
  // 2. AMBULANCE — 23 bilingual check points (Sheet1 row 7, cols C..Y)
  // ---------------------------------------------------------------
  const amWb = await loadWb('ambulance-check-list.xlsx');
  const amRow = amWb.worksheets[0].getRow(7);
  const points = [];
  for (let c = 3; c <= 25; c++) {
    const hi = clean(amRow.getCell(c).value);
    if (!hi) continue;
    points.push({ order: points.length + 1, hi, en: EN[hi] || hi });
  }

  // ---------------------------------------------------------------
  // 3. OHC MEDICINE — 99 items across 12 categories
  //    A row with no S.No but a name is a category header.
  // ---------------------------------------------------------------
  const medWb = await loadWb('ohc-medicine-check-list.xlsx');
  const medSheet = medWb.worksheets[0];
  const medicines = [];
  let category = null;
  for (let r = 5; r <= 126; r++) {
    const row = medSheet.getRow(r);
    const sr = num(row.getCell('B').value);
    const name = clean(row.getCell('C').value);
    if (!name) continue;
    if (sr === null) {
      category = name === 'ANTICEPTIC SOLUTION' ? 'ANTISEPTIC SOLUTION' : name;
      continue;
    }
    if (!category) continue;
    medicines.push({ order: medicines.length + 1, category, name });
  }


  return { staff, boxes, items, points, medicines, ITEM_HI };
}
