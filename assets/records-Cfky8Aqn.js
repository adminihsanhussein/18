import{i as e}from"./notifications-02TcF-6C.js";import"./theme-config-CSLxHe3X.js";import{i as t,r as n,t as r}from"./date-utils-DVY1kC5i.js";var i=[],a=[],o=`ally`,s=null;document.addEventListener(`DOMContentLoaded`,async()=>{let{data:{user:i}}=await e.auth.getUser();if(!i){window.location.href=`index.html`;return}let{data:a}=await e.from(`profiles`).select(`role`).eq(`id`,i.id).single();o=a?.role||`ally`;let u=o===`admin`,d=document.getElementById(`allyFilter`);if(u){let{data:t}=await e.from(`profiles`).select(`id, full_name`).eq(`role`,`ally`);t?.forEach(e=>{let t=document.createElement(`option`);t.value=e.id,t.textContent=e.full_name,d.appendChild(t)})}else d.parentElement.classList.add(`hidden`);let f=document.getElementById(`recordsMonthLabel`),m=document.getElementById(`openMonthPickerBtn`);function h(e){e?f.textContent=r(e):f.textContent=`جميع الشهور`}let g=localStorage.getItem(`globalFilterMonth`);g&&(s=g,h(s)),m.addEventListener(`click`,()=>{n(s,e=>{e?(t(e),s=e):(s=null,localStorage.removeItem(`globalFilterMonth`)),h(s),c()})}),window.addEventListener(`monthFilterChanged`,e=>{s=e.detail,h(s),c()}),await c(),document.getElementById(`searchInput`).addEventListener(`input`,l),document.getElementById(`allyFilter`).addEventListener(`change`,l),document.getElementById(`exportBtn`).addEventListener(`click`,p)});async function c(){let t=document.getElementById(`recordsList`);t&&(t.innerHTML=`
                    <div class="bg-surface-container-lowest rounded-3xl p-12 text-center border border-dashed border-primary/20">
                        <span class="material-symbols-outlined text-5xl text-primary animate-spin mb-3">progress_activity</span>
                        <p class="text-primary font-bold text-base">جاري جلب كافة الوصولات...</p>
                    </div>
                `);let n=null;if(o===`ally`){let{data:{user:t}}=await e.auth.getUser();n=t}let r=[],a=0,c=1e3;for(;;){let t=e.from(`receipts`).select(`
                    *,
                    profiles (full_name)
                `).order(`created_at`,{ascending:!1});o===`ally`&&n&&(t=t.eq(`ally_id`,n.id)),s&&(t=t.eq(`month_year`,s));let{data:i,error:l}=await t.range(a,a+c-1);if(l){console.error(`Error fetching receipts batch:`,l);break}if(!i||i.length===0||(r.push(...i),i.length<c))break;a+=c}i=r,l()}function l(){let e=document.getElementById(`searchInput`).value.toLowerCase(),t=document.getElementById(`allyFilter`).value;a=i.filter(n=>{let r=(n.subscriber_name||``).toLowerCase().includes(e)||n.receipt_number!==void 0&&n.receipt_number!==null&&n.receipt_number.toString().includes(e),i=!t||n.ally_id===t;return r&&i}),u(),f()}function u(){let e=document.getElementById(`recordsList`);if(e.innerHTML=``,a.length===0){e.innerHTML=`
                    <div class="bg-surface-container-lowest rounded-3xl p-12 text-center border border-dashed border-primary/20">
                        <span class="material-symbols-outlined text-6xl text-primary/20 mb-4">search_off</span>
                        <p class="text-on-surface-variant font-bold">لم يتم العثور على أي وصولات مطابقة</p>
                    </div>
                `;return}let t=document.createDocumentFragment();a.forEach((e,n)=>{let r=new Date(e.created_at).toLocaleDateString(`ar-EG`,{day:`numeric`,month:`long`,year:`numeric`}),i=e.receipt_date?new Date(e.receipt_date).toLocaleDateString(`ar-EG`,{day:`numeric`,month:`long`,year:`numeric`}):r,a=(e.subscriber_name||`م`).substring(0,2),s=document.createElement(`div`);s.className=`bg-surface-container-lowest rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer group border border-white/60 hover:border-primary/10 gap-6`,s.innerHTML=`
                    <div class="flex items-center gap-6 w-full md:w-auto">
                        <div class="w-16 h-16 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary font-black text-xl group-hover:bg-primary group-hover:text-white transition-all shadow-inner shrink-0 leading-none">
                            ${a}
                        </div>
                        <div class="space-y-1">
                            <h4 class="font-black text-primary text-xl tracking-tight">${e.subscriber_name||``}</h4>
                            <div class="flex items-center gap-3">
                                <span class="bg-primary/5 text-primary text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">#${e.receipt_number||``}</span>
                                <span class="text-[10px] text-on-surface-variant font-bold opacity-60">بواسطة: ${e.profiles?.full_name||`غير معروف`}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap md:flex-nowrap items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                        <div class="space-y-1 text-center md:text-right">
                            <p class="text-[10px] font-black text-primary/40 uppercase tracking-widest leading-none">تاريخ الوصل (الورقي)</p>
                            <p class="font-bold text-primary text-sm">${i}</p>
                        </div>

                        <div class="space-y-1 text-center md:text-right hidden sm:block">
                            <p class="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest leading-none">سجل النظام</p>
                            <p class="font-bold text-on-surface-variant/60 text-xs">${r}</p>
                        </div>

                        <div class="text-center md:text-left min-w-[120px]">
                            <p class="text-primary font-black text-3xl italic tracking-tighter">${(Number(e.amount)||0).toLocaleString()}<span class="text-xs not-italic mr-1">د.ع</span></p>
                        </div>

                        <div class="flex items-center gap-2">
                             ${o===`admin`?`
                                <button onclick="openEditModal('${encodeURIComponent(JSON.stringify(e))}')" class="p-3 bg-surface-container-high rounded-2xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm" title="تعديل">
                                    <span class="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button onclick="deleteReceipt('${e.id}', '${(e.subscriber_name||``).replace(/'/g,`\\'`)}')" class="p-3 bg-error/5 text-error rounded-2xl hover:bg-error hover:text-white transition-all shadow-sm" title="حذف">
                                    <span class="material-symbols-outlined text-lg">delete</span>
                                </button>
                             `:`
                                <span class="material-symbols-outlined text-primary/20">lock</span>
                             `}
                        </div>
                    </div>
                `,t.appendChild(s)}),e.appendChild(t)}var d=null;window.deleteReceipt=async(e,t)=>{if(o!==`admin`)return alert(`عذراً، هذه الصلاحية للمسؤول فقط`);d={id:e,name:t},document.getElementById(`deleteReceiptName`).textContent=t,document.getElementById(`deleteReceiptModal`).classList.remove(`hidden`),document.getElementById(`deleteReceiptModal`).classList.add(`flex`)},window.closeDeleteReceiptModal=()=>{document.getElementById(`deleteReceiptModal`).classList.add(`hidden`),document.getElementById(`deleteReceiptModal`).classList.remove(`flex`),d=null},window.executeDeleteReceipt=async()=>{if(!d)return;let t=document.getElementById(`confirmDeleteReceiptBtn`);t.disabled=!0,t.innerHTML=`<span class="material-symbols-outlined animate-spin">sync</span> جاري الحذف...`;try{let{error:t}=await e.from(`receipts`).delete().eq(`id`,d.id);if(t)throw t;closeDeleteReceiptModal(),c()}catch(e){alert(`خطأ في الحذف: `+e.message)}finally{t.disabled=!1,t.innerHTML=`نعم، احذف الوصل`}},window.openEditModal=e=>{if(o!==`admin`)return alert(`عذراً، هذه الصلاحية للمسؤول فقط`);let t=JSON.parse(decodeURIComponent(e));document.getElementById(`editId`).value=t.id,document.getElementById(`editName`).value=t.subscriber_name,document.getElementById(`editAmount`).value=t.amount,document.getElementById(`editNumber`).value=t.receipt_number;let n=t.receipt_date?t.receipt_date.split(`T`)[0]:t.created_at.split(`T`)[0];document.getElementById(`editDate`).value=n,document.getElementById(`editModal`).classList.remove(`hidden`)},window.closeEditModal=()=>{document.getElementById(`editModal`).classList.add(`hidden`)},window.submitEdit=async()=>{let t=document.getElementById(`editId`).value,n=document.getElementById(`editName`).value,r=parseInt(document.getElementById(`editAmount`).value),i=parseInt(document.getElementById(`editNumber`).value),a=document.getElementById(`editDate`).value;try{let{error:o}=await e.from(`receipts`).update({subscriber_name:n,amount:r,receipt_number:i,receipt_date:a}).eq(`id`,t);if(o)throw o;alert(`تم تحديث البيانات بنجاح`),closeEditModal(),c()}catch(e){alert(`خطأ في التحديث: `+e.message)}};function f(){let e=a.reduce((e,t)=>e+(Number(t.amount)||0),0),t=a.length,n=new Set(a.map(e=>e.ally_id).filter(Boolean)).size;document.getElementById(`totalAmountStat`).textContent=e.toLocaleString(),document.getElementById(`totalCountStat`).textContent=t.toLocaleString(),document.getElementById(`totalAlliesStat`).textContent=n.toLocaleString()}function p(){if(a.length===0)return alert(`لا توجد بيانات لتصديرها`);let e=[[`الرقم`,`المساهم`,`رقم الوصل`,`المبلغ`,`تاريخ الوصل`,`تاريخ النظام`,`الحليف`]];a.forEach((t,n)=>{let r=new Date(t.created_at).toLocaleDateString(`ar-EG`),i=t.receipt_date?new Date(t.receipt_date).toLocaleDateString(`ar-EG`):r;e.push([n+1,t.subscriber_name,t.receipt_number,t.amount,i,r,t.profiles?.full_name||``])});let t=`data:text/csv;charset=utf-8,﻿`+e.map(e=>e.join(`,`)).join(`
`),n=encodeURI(t),r=document.createElement(`a`);r.setAttribute(`href`,n),r.setAttribute(`download`,`records_${new Date().toLocaleDateString()}.csv`),document.body.appendChild(r),r.click(),document.body.removeChild(r)}