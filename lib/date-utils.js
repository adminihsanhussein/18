// Date utilities for global month filtering across Al-Bunyan app

// Arabic Month Names (Levantine/Iraqi standard used in app: كانون الثاني، شباط، الخ)
const ARABIC_MONTHS = [
    "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
    "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"
];

/**
 * Gets the currently selected month from localStorage, defaults to current real month.
 * @returns {string} Format: 'YYYY-MM'
 */
export function getSelectedMonth() {
    let saved = localStorage.getItem('globalFilterMonth');
    if (!saved) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        saved = `${year}-${month}`;
        localStorage.setItem('globalFilterMonth', saved);
    }
    return saved;
}

/**
 * Sets the selected month globally and triggers a custom event for pages to update.
 * @param {string} yyyyMm e.g. '2026-04'
 */
export function setSelectedMonth(yyyyMm) {
    if (yyyyMm) {
        localStorage.setItem('globalFilterMonth', yyyyMm);
        window.dispatchEvent(new CustomEvent('monthFilterChanged', { detail: yyyyMm }));
    }
}

/**
 * Returns user-friendly Arabic text for the selected month string.
 * @param {string} yyyyMm e.g. '2026-04' 
 * @returns {string} e.g. 'نيسان 2026'
 */
export function formatMonthArabic(yyyyMm) {
    if (!yyyyMm) return '';
    const [year, month] = yyyyMm.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    return `${ARABIC_MONTHS[monthIndex]} ${year}`;
}

/**
 * Gets the start and end boundary ISO strings for Supabase filtering
 * @param {string} yyyyMm e.g. '2026-04'
 * @returns { start: string, end: string }
 */
export function getMonthBounds(yyyyMm) {
    const [year, month] = yyyyMm.split('-');
    
    // Start of the month
    const startDate = new Date(year, parseInt(month, 10) - 1, 1);
    
    // Start of the NEXT month (acts as strict upper boundary)
    const endDate = new Date(year, parseInt(month, 10), 1);
    
    return {
        start: startDate.toISOString(),
        end: endDate.toISOString()
    };
}

/**
 * Opens a beautiful custom month picker modal.
 * @param {string|null} currentSelected The currently selected month (YYYY-MM).
 * @param {function} onSelect Callback when a month is selected.
 */
export function openGlobalMonthPicker(currentSelected, onSelect) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-primary/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300';
    modal.dir = 'rtl'; // specific RTL direction for the modal
    
    let year = new Date().getFullYear();
    let monthValue = null;

    if (currentSelected) {
        const parts = currentSelected.split('-');
        year = parseInt(parts[0], 10);
        monthValue = parts[1];
    }

    const content = document.createElement('div');
    content.className = 'bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden transform scale-95 transition-transform duration-300 flex flex-col relative';
    
    // Beautiful Header
    const header = document.createElement('div');
    header.className = 'bg-primary text-white p-6 flex flex-col gap-4 relative overflow-hidden';
    header.innerHTML = `
        <div class="absolute -left-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-secondary-fixed/20 rounded-full blur-2xl"></div>
        <div class="flex items-center justify-between z-10">
            <button id="nextYearBtn" class="p-2 hover:bg-white/20 active:scale-95 rounded-xl transition-all" title="السنة القادمة">
                <span class="material-symbols-outlined">chevron_right</span>
            </button>
            <h3 class="font-black text-3xl tracking-widest" id="yearDisplay">${year}</h3>
            <button id="prevYearBtn" class="p-2 hover:bg-white/20 active:scale-95 rounded-xl transition-all" title="السنة السابقة">
                <span class="material-symbols-outlined">chevron_left</span>
            </button>
        </div>
        <p class="text-white/80 text-center text-xs font-bold z-10 w-full flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">event</span> اختر الشهر لعرض الإحصائيات
        </p>
    `;

    // Months Grid
    const grid = document.createElement('div');
    grid.className = 'p-6 grid grid-cols-3 gap-3';
    
    function renderMonths() {
        grid.innerHTML = '';
        ARABIC_MONTHS.forEach((label, i) => {
            const mVal = String(i + 1).padStart(2, '0');
            const isSelected = monthValue === mVal && year.toString() === (currentSelected?.split('-')[0] || '');
            
            const btn = document.createElement('button');
            btn.className = `py-4 px-2 rounded-2xl font-bold text-sm transition-all focus:outline-none ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary/20 border border-transparent'}`;
            btn.textContent = label;
            btn.onclick = () => {
                const result = `${year}-${mVal}`;
                // Animate out
                modal.classList.remove('opacity-100');
                content.classList.remove('scale-100');
                setTimeout(() => {
                    document.body.removeChild(modal);
                    if(onSelect) onSelect(result);
                }, 300);
            };
            grid.appendChild(btn);
        });
    }

    // Actions Footer
    const footer = document.createElement('div');
    footer.className = 'p-4 border-t border-surface-container-high flex justify-between items-center bg-surface-container-lowest';
    footer.innerHTML = `
        <button id="clearPopupBtn" class="px-5 py-2.5 text-error bg-error/5 hover:bg-error/10 font-black rounded-xl text-xs transition-all flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">cancel</span> جميع الشهور
        </button>
        <button id="closePopupBtn" class="px-5 py-2.5 bg-surface-container-high text-primary hover:bg-primary hover:text-white font-black rounded-xl text-xs transition-all shadow-sm">إلغاء</button>
    `;

    content.appendChild(header);
    content.appendChild(grid);
    content.appendChild(footer);
    modal.appendChild(content);
    document.body.appendChild(modal);

    // Bind Event Listeners
    header.querySelector('#prevYearBtn').onclick = () => { year--; header.querySelector('#yearDisplay').textContent = year; renderMonths(); };
    header.querySelector('#nextYearBtn').onclick = () => { year++; header.querySelector('#yearDisplay').textContent = year; renderMonths(); };
    
    footer.querySelector('#closePopupBtn').onclick = () => {
        modal.classList.remove('opacity-100');
        content.classList.remove('scale-100');
        setTimeout(() => document.body.removeChild(modal), 300);
    };

    footer.querySelector('#clearPopupBtn').onclick = () => {
        modal.classList.remove('opacity-100');
        content.classList.remove('scale-100');
        setTimeout(() => {
            document.body.removeChild(modal);
            if(onSelect) onSelect(null);
        }, 300);
    };

    renderMonths();

    // Trigger open animation
    requestAnimationFrame(() => {
        modal.classList.add('opacity-100');
        content.classList.add('scale-100');
    });
}
