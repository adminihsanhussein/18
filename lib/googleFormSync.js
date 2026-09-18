/**
 * Google Form Sync Module for Al-Bunyan Al-Marsoos Receipts App
 * Supports dynamic configuration saved by Admin via settings page
 */

export const DEFAULT_GOOGLE_FORM_CONFIG = {
  formId: '1FAIpQLSfQMjSgbrv3diues9q_yuAAmX_qgh1TEeqOP1po8kSZ4LaUqA',
  postUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfQMjSgbrv3diues9q_yuAAmX_qgh1TEeqOP1po8kSZ4LaUqA/formResponse',
  viewUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfQMjSgbrv3diues9q_yuAAmX_qgh1TEeqOP1po8kSZ4LaUqA/viewform',
  entries: {
    subscriberName: 'entry.1521483675', // الاسم الثلاثي للمساهم
    amount: 'entry.674104686',         // مبلغ الوصل رقماً
    receiptNumber: 'entry.2054327106',    // رقم الوصل
    receiptDate: 'entry.1483196086',       // تاريخ الوصل (YYYY-MM-DD)
    holderName: 'entry.1561160346',       // اسم الحليف
    circleNumber: 'entry.1370839413'      // رقم الدائرة
  }
};

export const KNOWN_SHORT_LINKS = {
  'https://forms.gle/HAa2b3vrgWaNFgFAA': '1FAIpQLSfQMjSgbrv3diues9q_yuAAmX_qgh1TEeqOP1po8kSZ4LaUqA',
  'forms.gle/HAa2b3vrgWaNFgFAA': '1FAIpQLSfQMjSgbrv3diues9q_yuAAmX_qgh1TEeqOP1po8kSZ4LaUqA'
};

export const KNOWN_FORM_ENTRIES = {
  // New Official Form (بغداد - الرصافة مع حقل رقم الدائرة)
  '1FAIpQLSfQMjSgbrv3diues9q_yuAAmX_qgh1TEeqOP1po8kSZ4LaUqA': {
    subscriberName: 'entry.1521483675',
    amount: 'entry.674104686',
    receiptNumber: 'entry.2054327106',
    receiptDate: 'entry.1483196086',
    holderName: 'entry.1561160346',
    circleNumber: 'entry.1370839413'
  },
  // Previous Form
  '1FAIpQLScjK6FLmz9TbzFcZlhyozHu01hX3YCWQaTWKHH__44saa_cDw': {
    subscriberName: 'entry.1280909476',
    amount: 'entry.1112821962',
    receiptNumber: 'entry.557096520',
    receiptDate: 'entry.62129398',
    holderName: 'entry.1691430342'
  },
  // User's Test Form
  '1FAIpQLSeaMD5MlYZ9t_p0cNqK_yJPeVxEag53Bi6H9Yo3hwXKwNqOiQ': {
    subscriberName: 'entry.610782960',
    amount: 'entry.1090657622',
    receiptNumber: 'entry.1965595064',
    receiptDate: 'entry.1152295121',
    holderName: 'entry.954135380'
  }
};

/**
 * Get current configured Circle/District Number (Default: '18')
 */
export function getCircleNumber() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('circleNumber');
    if (saved && saved.trim()) return saved.trim();
  }
  return '18';
}

/**
 * Save Circle/District Number
 */
export function setCircleNumber(num) {
  if (typeof localStorage !== 'undefined') {
    if (num && String(num).trim()) {
      localStorage.setItem('circleNumber', String(num).trim());
    } else {
      localStorage.removeItem('circleNumber');
    }
  }
}

/**
 * Helper to match questions in a Google Form to application fields by title (name-based mapping)
 */
export function matchGoogleFormQuestions(questions) {
  const detectedEntries = {
    subscriberName: null,
    amount: null,
    receiptNumber: null,
    receiptDate: null,
    holderName: null,
    circleNumber: null
  };

  const fieldDetails = {
    subscriberName: { label: 'اسم المساهم / المتبرع', entryId: '', matchedTitle: '' },
    amount: { label: 'مبلغ الوصل', entryId: '', matchedTitle: '' },
    receiptNumber: { label: 'رقم الوصل / السند', entryId: '', matchedTitle: '' },
    receiptDate: { label: 'تاريخ الوصل', entryId: '', matchedTitle: '' },
    holderName: { label: 'اسم صاحب الدبلك / الحليف', entryId: '', matchedTitle: '' },
    circleNumber: { label: 'رقم الدائرة', entryId: '', matchedTitle: '' }
  };

  if (!Array.isArray(questions)) return { entries: detectedEntries, details: fieldDetails, allQuestions: [] };

  const parsedQuestions = [];

  // Pass 1: Extract all entry IDs and titles
  questions.forEach(q => {
    if (!q) return;
    const title = (q[1] || '').trim();
    const itemData = q[4];
    if (!itemData || !itemData[0] || !itemData[0][0]) return;
    
    const entryId = `entry.${itemData[0][0]}`;
    parsedQuestions.push({ entryId, title });
  });

  // Pass 2: Match each question to app fields by title keywords
  parsedQuestions.forEach(({ entryId, title }) => {
    const cleanTitle = title.toLowerCase();

    // 1. Circle / District Number (high priority to prevent confusion with receipt number)
    const isCircle = cleanTitle.includes('دائر') || cleanTitle.includes('دائرة') || cleanTitle.includes('الدائرة') || cleanTitle.includes('district');
    if (isCircle && !detectedEntries.circleNumber) {
      detectedEntries.circleNumber = entryId;
      fieldDetails.circleNumber.entryId = entryId;
      fieldDetails.circleNumber.matchedTitle = title;
      return;
    }

    // 2. Holder / Ally Name (high priority for holder keywords to prevent mixing with subscriber name)
    const isHolder = cleanTitle.includes('صاحب') || cleanTitle.includes('دبلك') || cleanTitle.includes('حليف') || cleanTitle.includes('جامع') || cleanTitle.includes('مسؤول الدفتر');
    if (isHolder && !detectedEntries.holderName) {
      detectedEntries.holderName = entryId;
      fieldDetails.holderName.entryId = entryId;
      fieldDetails.holderName.matchedTitle = title;
      return;
    }

    // 3. Receipt Date
    const isDate = cleanTitle.includes('تاريخ') || cleanTitle.includes('التاريخ') || cleanTitle.includes('يوم');
    if (isDate && !detectedEntries.receiptDate) {
      detectedEntries.receiptDate = entryId;
      fieldDetails.receiptDate.entryId = entryId;
      fieldDetails.receiptDate.matchedTitle = title;
      return;
    }

    // 4. Receipt Number
    const isNumber = (cleanTitle.includes('رقم') || cleanTitle.includes('تسلسل')) && 
                     !cleanTitle.includes('مبلغ') && !cleanTitle.includes('هاتف') && !cleanTitle.includes('جوال') && !cleanTitle.includes('دائر');
    if (isNumber && !detectedEntries.receiptNumber) {
      detectedEntries.receiptNumber = entryId;
      fieldDetails.receiptNumber.entryId = entryId;
      fieldDetails.receiptNumber.matchedTitle = title;
      return;
    }

    // 5. Amount
    const isAmount = cleanTitle.includes('مبلغ') || cleanTitle.includes('المبلغ') || cleanTitle.includes('دينار') || cleanTitle.includes('قيمة');
    if (isAmount && !detectedEntries.amount) {
      detectedEntries.amount = entryId;
      fieldDetails.amount.entryId = entryId;
      fieldDetails.amount.matchedTitle = title;
      return;
    }

    // 6. Subscriber Name
    const isSubscriber = (cleanTitle.includes('مساهم') || cleanTitle.includes('متبرع') || cleanTitle.includes('مشترك') || cleanTitle.includes('اسم')) && !isHolder && !isCircle;
    if (isSubscriber && !detectedEntries.subscriberName) {
      detectedEntries.subscriberName = entryId;
      fieldDetails.subscriberName.entryId = entryId;
      fieldDetails.subscriberName.matchedTitle = title;
      return;
    }
  });

  return { entries: detectedEntries, details: fieldDetails, allQuestions: parsedQuestions };
}

/**
 * Parse Google Form HTML directly on the client side
 */
export function parseGoogleFormHtml(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    throw new Error('محتوى HTML غير صالح.');
  }

  const loadMatch = htmlContent.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);\s*<\/script>/s);
  if (!loadMatch || !loadMatch[1]) {
    throw new Error('تعذر قراءة بيانات حقول نموذج كوكل. تأكد من أن الرابط عام ومتاح للجميع.');
  }

  let parsed;
  try {
    parsed = JSON.parse(loadMatch[1]);
  } catch (e) {
    throw new Error('فشل قراءة شفرة نموذج كوكل الحالية.');
  }

  const questions = parsed[1] && parsed[1][1] ? parsed[1][1] : [];
  return matchGoogleFormQuestions(questions);
}

/**
 * Helper to parse any Google Form URL/ID input
 */
export function parseGoogleFormUrl(rawUrl, explicitFormId = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Case 0: Explicit form ID passed
  if (explicitFormId) {
    return {
      formId: explicitFormId,
      postUrl: `https://docs.google.com/forms/d/e/${explicitFormId}/formResponse`,
      viewUrl: `https://docs.google.com/forms/d/e/${explicitFormId}/viewform`,
      rawUrl: trimmed
    };
  }

  // Case 0.5: Known short links
  if (KNOWN_SHORT_LINKS[trimmed] || KNOWN_SHORT_LINKS[trimmed.replace(/\/+$/, '')]) {
    const matchedId = KNOWN_SHORT_LINKS[trimmed] || KNOWN_SHORT_LINKS[trimmed.replace(/\/+$/, '')];
    return {
      formId: matchedId,
      postUrl: `https://docs.google.com/forms/d/e/${matchedId}/formResponse`,
      viewUrl: `https://docs.google.com/forms/d/e/${matchedId}/viewform`,
      rawUrl: trimmed
    };
  }

  // Case 1: Direct formId string (e.g. 1FAIpQLScjK6FLmz9TbzFcZlhyozHu01hX3YCWQaTWKHH__44saa_cDw)
  if (/^[a-zA-Z0-9_-]{25,80}$/.test(trimmed) && !trimmed.includes('/')) {
    return {
      formId: trimmed,
      postUrl: `https://docs.google.com/forms/d/e/${trimmed}/formResponse`,
      viewUrl: `https://docs.google.com/forms/d/e/${trimmed}/viewform`,
      rawUrl: trimmed
    };
  }

  // Case 2: Full docs.google.com URL with form ID
  const match = trimmed.match(/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const formId = match[1];
    return {
      formId,
      postUrl: `https://docs.google.com/forms/d/e/${formId}/formResponse`,
      viewUrl: `https://docs.google.com/forms/d/e/${formId}/viewform`,
      rawUrl: trimmed
    };
  }

  // Case 3: Saved formId from local storage for short links (e.g. forms.gle)
  const savedFormId = typeof localStorage !== 'undefined' ? localStorage.getItem('googleFormId') : null;
  if (savedFormId && trimmed.includes('forms.gle')) {
    return {
      formId: savedFormId,
      postUrl: `https://docs.google.com/forms/d/e/${savedFormId}/formResponse`,
      viewUrl: `https://docs.google.com/forms/d/e/${savedFormId}/viewform`,
      rawUrl: trimmed
    };
  }

  // Case 4: Other full URL (fallback)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let postUrl = trimmed;
    let viewUrl = trimmed;

    if (trimmed.endsWith('/viewform')) {
      postUrl = trimmed.replace(/\/viewform.*$/, '/formResponse');
    } else if (trimmed.endsWith('/formResponse')) {
      viewUrl = trimmed.replace(/\/formResponse.*$/, '/viewform');
    } else {
      postUrl = trimmed.replace(/\/+$/, '') + '/formResponse';
    }

    return {
      formId: '',
      postUrl,
      viewUrl,
      rawUrl: trimmed
    };
  }

  return null;
}

/**
 * Get active Google Form configuration dynamically
 */
export function getGoogleFormConfig() {
  const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('googleFormUrl') : null;
  let savedEntries = null;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('googleFormEntries') : null;
    if (raw) savedEntries = JSON.parse(raw);
  } catch (e) {
    console.warn('Could not parse saved googleFormEntries:', e);
  }

  let baseConfig = { ...DEFAULT_GOOGLE_FORM_CONFIG };

  if (savedUrl) {
    const parsed = parseGoogleFormUrl(savedUrl);
    if (parsed) {
      baseConfig = {
        ...DEFAULT_GOOGLE_FORM_CONFIG,
        formId: parsed.formId || DEFAULT_GOOGLE_FORM_CONFIG.formId,
        postUrl: parsed.postUrl,
        viewUrl: parsed.viewUrl,
        customUrl: savedUrl
      };
    }
  }

  const knownEntries = KNOWN_FORM_ENTRIES[baseConfig.formId];
  const entries = savedEntries 
    ? { ...DEFAULT_GOOGLE_FORM_CONFIG.entries, ...savedEntries }
    : (knownEntries ? { ...knownEntries } : { ...DEFAULT_GOOGLE_FORM_CONFIG.entries });

  return { ...baseConfig, entries };
}

/**
 * Save updated Google Form URL and optional custom entries
 */
export function saveGoogleFormUrl(url, customEntries = null, formId = '') {
  if (!url || !url.trim()) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('googleFormUrl');
      localStorage.removeItem('googleFormEntries');
      localStorage.removeItem('googleFormId');
    }
    return { success: true, config: DEFAULT_GOOGLE_FORM_CONFIG };
  }

  let targetUrl = url.trim();
  let extractedId = formId;

  // Check known short links
  if (!extractedId && (KNOWN_SHORT_LINKS[targetUrl] || KNOWN_SHORT_LINKS[targetUrl.replace(/\/+$/, '')])) {
    extractedId = KNOWN_SHORT_LINKS[targetUrl] || KNOWN_SHORT_LINKS[targetUrl.replace(/\/+$/, '')];
  }

  // Extract formId if present or convert forms.gle URL to canonical format if ID is known
  const match = targetUrl.match(/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    extractedId = match[1];
    targetUrl = `https://docs.google.com/forms/d/e/${extractedId}/viewform`;
  } else if (extractedId) {
    targetUrl = `https://docs.google.com/forms/d/e/${extractedId}/viewform`;
  }

  const parsed = parseGoogleFormUrl(targetUrl, extractedId);
  if (!parsed && !extractedId && !targetUrl.includes('forms.gle')) {
    throw new Error('رابط غير صالح. يرجى إدخال رابط فورمة كوكل صحيح.');
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('googleFormUrl', targetUrl);
    if (extractedId) {
      localStorage.setItem('googleFormId', extractedId);
    } else {
      localStorage.removeItem('googleFormId');
    }

    if (customEntries && typeof customEntries === 'object') {
      localStorage.setItem('googleFormEntries', JSON.stringify(customEntries));
    }
  }

  return { 
    success: true, 
    parsed: parsed || { 
      formId: extractedId, 
      postUrl: extractedId ? `https://docs.google.com/forms/d/e/${extractedId}/formResponse` : targetUrl, 
      viewUrl: targetUrl 
    }, 
    config: getGoogleFormConfig() 
  };
}

// Backwards-compatibility Proxy for GOOGLE_FORM_CONFIG
export const GOOGLE_FORM_CONFIG = new Proxy({}, {
  get(target, prop) {
    const active = getGoogleFormConfig();
    return active[prop];
  }
});

/**
 * Check if a receipt has been marked as sent to Google Form
 */
export function isReceiptSyncedToGoogle(receipt) {
  if (!receipt) return false;
  if (receipt.sent_to_google) return true;
  const key = `synced_gform_${receipt.id || receipt.receipt_number}`;
  return localStorage.getItem(key) === 'true';
}

/**
 * Mark a receipt as synced in localStorage & Supabase if possible
 */
export async function markReceiptSyncedToGoogle(receipt, supabase = null) {
  if (!receipt) return;
  const key = `synced_gform_${receipt.id || receipt.receipt_number}`;
  localStorage.setItem(key, 'true');
  receipt.sent_to_google = true;

  if (supabase && receipt.id) {
    try {
      await supabase
        .from('receipts')
        .update({ sent_to_google: true })
        .eq('id', receipt.id);
    } catch (e) {
      console.warn('Could not update sent_to_google status in DB:', e);
    }
  }
}

/**
 * Generate a pre-filled Google Form URL for manual review
 */
export function getPrefilledGoogleFormUrl(receipt, allyName = '') {
  const config = getGoogleFormConfig();
  if (!receipt) return config.viewUrl;
  
  const params = new URLSearchParams();
  params.append('usp', 'pp_url');
  
  const subName = receipt.subscriber_name || receipt.subscriberName || '';
  const amt = String(receipt.amount || '');
  const rNum = String(receipt.receipt_number || receipt.receiptNumber || '');
  const rDate = receipt.receipt_date || receipt.receiptDate || new Date().toISOString().substring(0, 10);
  const hName = allyName || receipt.ally_name || receipt.allyName || '';
  const circleNum = getCircleNumber();

  if (config.entries.subscriberName) params.append(config.entries.subscriberName, subName);
  if (config.entries.amount) params.append(config.entries.amount, amt);
  if (config.entries.receiptNumber) params.append(config.entries.receiptNumber, rNum);
  if (config.entries.receiptDate) params.append(config.entries.receiptDate, rDate);
  if (config.entries.holderName) params.append(config.entries.holderName, hName);
  if (config.entries.circleNumber) params.append(config.entries.circleNumber, String(circleNum));

  return `${config.viewUrl}?${params.toString()}`;
}

/**
 * Submit a single receipt directly to Google Form via background POST
 */
export async function sendReceiptToGoogleForm(receipt, allyName = '', supabase = null) {
  if (!receipt) throw new Error('بيانات الوصل مفقودة');
  const config = getGoogleFormConfig();

  const subName = receipt.subscriber_name || receipt.subscriberName || '';
  const amt = String(receipt.amount || '');
  const rNum = String(receipt.receipt_number || receipt.receiptNumber || '');
  const rDate = receipt.receipt_date || receipt.receiptDate || new Date().toISOString().substring(0, 10);
  const hName = allyName || receipt.ally_name || receipt.allyName || '';
  const circleNum = getCircleNumber();

  const formData = {};
  if (config.entries.subscriberName) formData[config.entries.subscriberName] = subName;
  if (config.entries.amount) formData[config.entries.amount] = amt;
  if (config.entries.receiptNumber) formData[config.entries.receiptNumber] = rNum;
  if (config.entries.receiptDate) formData[config.entries.receiptDate] = rDate;
  if (config.entries.holderName) formData[config.entries.holderName] = hName;
  if (config.entries.circleNumber) formData[config.entries.circleNumber] = String(circleNum);

  const isLocal = typeof window !== 'undefined' && window.location && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.startsWith('192.168.')
  );

  let sentSuccessfully = false;

  // Try local server API if running on dev server
  if (isLocal) {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-google-form',
          postUrl: config.postUrl,
          formData
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          sentSuccessfully = true;
        }
      }
    } catch (apiErr) {
      console.warn('Local Admin API submission failed, using client fetch fallback:', apiErr);
    }
  }

  // Fallback to client-side fetch if API not used or failed
  if (!sentSuccessfully) {
    const params = new URLSearchParams();
    Object.entries(formData).forEach(([k, v]) => params.append(k, v));

    try {
      await fetch(config.postUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
    } catch (err) {
      console.error('فشل إرسال الوصل إلى Google Form عبر العميل:', err);
      throw err;
    }
  }

  await markReceiptSyncedToGoogle(receipt, supabase);
  return { success: true };
}

/**
 * Bulk submit multiple receipts sequentially to Google Form
 */
export async function sendBulkReceiptsToGoogleForm(receipts, allyName = '', onProgress = null, supabase = null) {
  if (!receipts || receipts.length === 0) return { total: 0, sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;
  const total = receipts.length;

  for (let i = 0; i < total; i++) {
    const r = receipts[i];
    if (onProgress) {
      onProgress(i + 1, total, r);
    }

    try {
      await sendReceiptToGoogleForm(r, allyName, supabase);
      sent++;
    } catch (e) {
      console.error(`خطأ أثناء تحويل الوصل رقم ${r.receipt_number}:`, e);
    }

    // Small delay between requests to avoid rate limits
    if (i < total - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return { total, sent, skipped };
}

