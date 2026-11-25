/* 時間割アプリ:年度 × 1Q〜4Q × 月〜土 × 6時限(時間は固定)。保存先は localStorage */
/* ===== 共通 ===== */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'); // HTML に入れる前の無害化
const uid = () => Math.random().toString(36).slice(2, 10);
const setVisible = (id, on, display = 'block') => {
  $(id).style.display = on ? display : 'none';
};
const openModal = id => $(id).classList.add('open');
const closeModal = id => $(id).classList.remove('open');
const KEY = 'timetable:data';
const DAYS = [...'月火水木金土'];
/** 時限(固定) */
const PERIOD_TIMES = [
  '9:00〜10:40',
  '10:55〜12:35',
  '13:25〜15:05',
  '15:20〜17:00',
  '17:15〜18:55',
  '19:05〜20:45',
];
const PERIODS = PERIOD_TIMES.map((time, i) => ({ id: i + 1, label: `${i + 1}限`, time }));
/** 講義の色(名前, 背景, 文字)。講義には番号 colorIdx で保存する */
/** 講義の背景色。講義には番号 colorIdx で保存する */
const PALETTE = [
  '#AFD9F5',
  '#A9BEF2',
  '#BEE3A8',
  '#D6DE9C',
  '#F3E48F',
  '#F6C99A',
  '#F3B49C',
  '#F3C6E2',
  '#D6C6F0',
];
const Q_NAMES = ['1Q', '2Q', '3Q', '4Q'];
/** 年度は4月始まり(2026/4〜2027/3 = 2026年度) */
const fiscalYear = (d = new Date()) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
/* ===== 状態 ===== */
let yearNames = {};         // 年度の表示名 { 2026: '2026年度(留学)' }(未設定なら「2026年度」)
let yearOrder = [];          // 年度の並び順 [2026, 2027](年度メニューの ▲▼ で入れ替える)
let patterns = [];          // 時間割 [{ id, year: 2026, name: '1Q', courses: [...] }, ...](年度→Qの順に並べる)
let activeId;               // 表示中の時間割の ID
let draft;                  // 登録・編集フォームの下書き
let viewing;                // 詳細表示中の講義
const selected = new Set(); // 削除モードで選択中の講義 ID
const current = () => patterns.find(p => p.id === activeId);
const courses = () => current().courses;
const years = () => yearOrder;
/** 年度の表示名(名前を変更していなければ「2026年度」) */
const yearLabel = y => yearNames[y] || `${y}年度`;
const quartersOf = year => patterns.filter(p => p.year === year);
/** 指定した年度の1Q〜4Qを(なければ)作って、並べ直す */
function ensureYear(year) {
  if (!yearOrder.includes(year)) {
    // 並びを入れ替えていなければ西暦順の位置に、入れ替えていれば末尾に追加する
    const ascending = yearOrder.every((y, i) => !i || yearOrder[i - 1] < y);
    yearOrder.push(year);
    if (ascending) yearOrder.sort((a, b) => a - b);
  }
  Q_NAMES.forEach(name => {
    if (!patterns.some(p => p.year === year && p.name === name)) {
      patterns.push({ id: uid(), year, name, courses: [] });
    }
  });
  patterns.sort((a, b) => a.year - b.year || Q_NAMES.indexOf(a.name) - Q_NAMES.indexOf(b.name));
}
const findCourse = (day, period) => courses().find(c => c.day === day && c.period === period);
/* ===== 保存・読み込み ===== */
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ patterns, activeId, yearNames, yearOrder: yearOrder }));
    setVisible('saveError', false);
  } catch (e) {
    setVisible('saveError', true);
  }
}
function load() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {}
  patterns = Array.isArray(saved.patterns) ? saved.patterns : [];
  yearNames = saved.yearNames && typeof saved.yearNames === 'object' ? saved.yearNames : {};
  // 年度のない古いデータは、今の年度のものとして扱う
  patterns.forEach(p => { if (!p.year) p.year = fiscalYear(); });
  // 年度の並び順(保存された順 + 順番が未保存の年度は西暦順で後ろに)
  const allYears = [...new Set(patterns.map(p => p.year))].sort((a, b) => a - b);
  const savedOrder = Array.isArray(saved.yearOrder) ? saved.yearOrder.filter(y => allYears.includes(y)) : [];
  yearOrder = [...new Set([...savedOrder, ...allYears])];
  // 今の年度の1Q〜4Q を必ず用意する
  ensureYear(fiscalYear());
  activeId = patterns.some(p => p.id === saved.activeId)
    ? saved.activeId
    : patterns.find(p => p.year === fiscalYear()).id;
}
/** 保存して、表を描き直す */
function update() {
  save();
  render();
}
/** 講義を削除する(modalId があればそのモーダルも閉じる) */
function deleteCourses(ids, modalId) {
  current().courses = courses().filter(c => !ids.includes(c.id));
  update();
  if (modalId) closeModal(modalId);
}
/* ===== 表の描画 ===== */
function render() {
  renderHeader();
  renderGrid();
}
/** タイトル・矢印・削除ボタンの状態を更新 */
function renderHeader() {
  const list = quartersOf(current().year);
  const index = list.indexOf(current());
  $('appTitle').textContent = current().name;
  $('prevBtn').disabled = index === 0;
  $('nextBtn').disabled = index === list.length - 1;
  // 年度のメニュー(各年度 + ✎ / 年度を追加 / この年度を削除)
  $('yearBtn').textContent = `${yearLabel(current().year)} ▾`;
  $('yearMenu').innerHTML = years().map(y => `
    <div class="year-item${y === current().year ? ' on' : ''}" data-year="${y}" onclick="changeYear('${y}')">
      <span class="year-handle" aria-label="ドラッグして並べ替え"
            onpointerdown="startYearDrag(event)" onclick="event.stopPropagation()">≡</span>
      <span class="year-name">${esc(yearLabel(y))}</span>
      <button type="button" class="year-edit" aria-label="${esc(yearLabel(y))}の名前を変更"
              onclick="event.stopPropagation(); openYearRename(${y})">✎</button>
    </div>`).join('')
    + '<div class="year-item year-action" onclick="changeYear(\'__add\')">＋ 年度を追加</div>'
    + (years().length > 1 ? '<div class="year-item year-action" onclick="changeYear(\'__del\')">－ この年度を削除</div>' : '');
  // 削除ボタン:未選択なら説明文、選択中なら件数つき
  $('deleteConfirmBtn').disabled = !selected.size;
  $('deleteConfirmBtn').innerHTML = selected.size
    ? `選択した講義を<wbr>削除(${selected.size}件)`
    : '講義をタップして<wbr>削除する';
}
/** 表(曜日見出し + 時限ごとの行)を組み立てる */

function renderGrid() {
  const today = new Date().getDay() - 1;
  const head = DAYS
    .map((d, i) =>
      `<div class="day-head${i === today ? ' today' : ''}">${d}</div>`
    )
    .join('');
  const rows = PERIODS.map((p, r) => {
    const zebra = r % 2 ? 'row-odd' : 'row-even';
    const periodCell = `
      <div class="period-cell ${zebra}">
        <div class="p-label">${p.label}</div>
        <div class="p-time">${p.time}</div>
      </div>`;
    return periodCell +
      DAYS.map(day => renderCell(day, p.id, zebra)).join('');
  }).join('');
  $('gridScroll').innerHTML =
    `<div class="grid" id="grid">
      <div class="corner"></div>
      ${head}
      ${rows}
    </div>`;
}

/** 1コマ(講義があれば色と名前・場所を表示) */
function renderCell(day, periodId, zebra) {
  const c = findCourse(day, periodId);
  const cls = `cell ${zebra}${selected.has(c?.id) ? ' selected-for-delete' : ''}`;
  const click = `onclick="tapCell('${day}', ${periodId})"`;
  // 講義がないコマ
  if (!c) return `<div class="${cls}" ${click}></div>`;
  // 講義があるコマ
  const bg = PALETTE[c.colorIdx] ?? PALETTE[0];
  const name = `<div class="c-name">${esc(c.name)}</div>`;
  const room = c.room ? `<div class="c-room">${esc(c.room)}</div>` : '';
  return `<div class="${cls}" ${click} style="background:${bg}">${name}${room}</div>`;
}
/** コマをタップ:削除モードなら選択の切り替え、通常なら詳細 or 新規登録 */
function tapCell(day, period) {
  const c = findCourse(day, period);
  if (document.body.classList.contains('delete-mode')) {
    if (!c) return;
    selected.has(c.id) ? selected.delete(c.id) : selected.add(c.id);
    render();
  } else if (c) {
    openView(c);
  } else {
    openForm(null, day, period);
  }
}
function setMode(value) {
  selected.clear();
  document.body.classList.toggle('delete-mode', value === 'delete');
  render();
}
function deleteSelected() {
  if (!confirm(`選択した${selected.size}件の講義を削除しますか?`)) return;
  const ids = [...selected];
  selected.clear();
  deleteCourses(ids);
}
/* ===== 時間割の切り替え(矢印・スワイプ。移動は同じ年度の中だけ) ===== */
function step(dir) {
  const list = quartersOf(current().year);
  const next = list[list.indexOf(current()) + dir];
  if (!next) return;
  activeId = next.id;
  selected.clear();
  update();
}
/* ===== 年度の切り替え・追加・削除 ===== */
function changeYear(value) {
  closeYearMenu();
  const name = current().name;
  if (value === '__add') {
    openYearAdd();
    return renderHeader(); // プルダウンの表示を元の年度に戻す(モーダルは開いたまま)
  }
  if (value === '__del') {
    const year = current().year;
    if (!confirm(`${yearLabel(year)}の時間割(1Q〜4Q)をすべて削除しますか?`)) return renderHeader();
    patterns = patterns.filter(p => p.year !== year);
    delete yearNames[year];
    yearOrder = yearOrder.filter(y => y !== year);
    const rest = years();
    const near = rest.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a));
    activeId = patterns.find(p => p.year === near && p.name === name).id;
  } else {
    activeId = patterns.find(p => p.year === +value && p.name === name).id;
  }
  selected.clear();
  update();
}
/* ----- 年度メニューの開閉 ----- */
const closeYearMenu = () => $('yearMenu').classList.remove('open');
function toggleYearMenu() {
  $('yearMenu').classList.toggle('open');
}
/** 年度メニューの ≡ をドラッグして並べ替える(マウス・タッチ共通) */
let suppressClickUntil = 0; // ドラッグ直後のクリック(年度の切り替え)を無視するための時刻
function startYearDrag(e) {
  e.preventDefault();
  e.stopPropagation();
  const handle = e.currentTarget;
  const row = handle.closest('.year-item');
  const isYearRow = el => !!el && el.dataset.year !== undefined;
  const middle = el => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  const startY = e.clientY;
  const startTop = row.offsetTop;
  row.classList.add('dragging');
  handle.setPointerCapture(e.pointerId);
  const move = ev => {
    // 指(カーソル)が隣の行の中央を越えたら、その行と入れ替える
    // (素早く動かしたときのために、止まるまで繰り返す)
    for (let moved = true; moved;) {
      const prev = row.previousElementSibling;
      const next = row.nextElementSibling;
      moved = true;
      if (isYearRow(prev) && ev.clientY < middle(prev)) row.parentNode.insertBefore(row, prev);
      else if (isYearRow(next) && ev.clientY > middle(next)) row.parentNode.insertBefore(next, row);
      else moved = false;
    }
    // つかんでいる行は、指に付いてくるように動かす
    row.style.transform = `translateY(${ev.clientY - startY - (row.offsetTop - startTop)}px)`;
  };
  const end = () => {
    ['pointermove', 'pointerup', 'pointercancel'].forEach(t => handle.removeEventListener(t, t === 'pointermove' ? move : end));
    row.classList.remove('dragging');
    row.style.transform = '';
    suppressClickUntil = Date.now() + 300;
    const order = [...row.parentNode.querySelectorAll('.year-item[data-year]')].map(el => +el.dataset.year);
    if (order.join() !== yearOrder.join()) {
      yearOrder = order;
      update();
    }
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
/* ----- 年度の追加(モーダルで西暦を入力) ----- */
function openYearAdd() {
  $('addYearInput').value = Math.min(Math.max(...years()) + 1, 2100); // 初期値は最後の年度の次の年
  setVisible('addYearError', false);
  openModal('addYearOverlay');
  $('addYearInput').select();
}
function applyYearAdd() {
  // 全角数字も受け付ける
  const text = $('addYearInput').value.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).trim();
  const year = +text;
  if (!/^\d{4}$/.test(text) || year < 2000 || year > 2100) {
    setVisible('addYearError', true);
    return;
  }
  const name = current().name;
  ensureYear(year); // すでにある年度なら何も増えず、その年度に移動するだけ
  activeId = patterns.find(p => p.year === year && p.name === name).id;
  selected.clear();
  closeModal('addYearOverlay');
  update();
}
/* ----- 年度の名前変更(空にすると「2026年度」に戻る) ----- */
let renamingYear; // 名前を変更中の年度
function openYearRename(year) {
  closeYearMenu();
  renamingYear = year;
  $('renameYearInput').value = yearNames[year] || '';
  $('renameYearInput').placeholder = `${year}年度`;
  openModal('renameYearOverlay');
  $('renameYearInput').focus();
}
function applyYearRename() {
  const year = renamingYear;
  const text = $('renameYearInput').value.trim();
  if (text) yearNames[year] = text;
  else delete yearNames[year];
  closeModal('renameYearOverlay');
  update();
}
// 左右の矢印キー:前・次のQへ移動(モーダルを開いている間や、入力欄の操作中は動かさない)
document.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (document.querySelector('.modal-overlay.open')) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  e.preventDefault();
  step(e.key === 'ArrowRight' ? 1 : -1);
});
// スワイプ:指を置いた位置と離した位置の差で判定
let swipeX, swipeY;
$('gridScroll').addEventListener('touchstart', e => {
  swipeX = e.touches[0].clientX;
  swipeY = e.touches[0].clientY;
}, { passive: true });
$('gridScroll').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - swipeX;
  const dy = e.changedTouches[0].clientY - swipeY;
  const isSwipe = Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5;
  if (isSwipe) step(dx < 0 ? 1 : -1);
}, { passive: true });
// ドラッグ直後に出るクリックは無視する(並べ替えのたびに年度が切り替わらないように)
document.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);
// モーダルの外側をクリックしたら閉じる
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
  if (!e.target.closest('.year-dd')) closeYearMenu(); // 年度メニューの外側をクリックしたら閉じる
});
/* ===== 講義の登録・編集フォーム ===== */
/** 曜日・時限のプルダウン(.slot-row 内) */
function renderSlots() {
  const dayOptions = slot => DAYS
    .map(d => `<option${d === slot.day ? ' selected' : ''}>${d}</option>`)
    .join('');
  const periodOptions = slot => PERIODS
    .map(p => `<option value="${p.id}"${p.id === slot.period ? ' selected' : ''}>${p.label}</option>`)
    .join('');
  const removeButton = i => draft.slots.length > 1
    ? `<button class="removeSlotBtn" aria-label="このコマを削除"
         onclick="draft.slots.splice(${i}, 1); renderSlots()">×</button>`
    : '';
  $('slotsList').innerHTML = draft.slots.map((s, i) => `
    <div class="slot-row">
      <select onchange="draft.slots[${i}].day = this.value">${dayOptions(s)}</select>
      <select onchange="draft.slots[${i}].period = +this.value">${periodOptions(s)}</select>
      ${removeButton(i)}
    </div>`).join('');
}
/** 登録するクォーターのチップ */
function renderQs() {
  $('qRow').innerHTML = Q_NAMES.map(q => `
    <button type="button" class="chip${draft.qs.includes(q) ? ' on' : ''}"
            onclick="toggleQ('${q}')">${q}</button>`).join('');
}
/** クォーターを切り替える(最低1つは選んだ状態にする) */
function toggleQ(q) {
  const has = draft.qs.includes(q);
  if (has && draft.qs.length === 1) return;
  draft.qs = Q_NAMES.filter(x => (x === q ? !has : draft.qs.includes(x)));
  renderQs();
}
/** 色の選択パレット */
function renderColors() {
  $('colorRow').innerHTML = PALETTE.map((bg, i) => `
    <div class="swatch${i === draft.colorIdx ? ' selected' : ''}"
         style="background:${bg}"
         onclick="draft.colorIdx = ${i}; renderColors()"></div>`).join('');
}
/** 直前のコマの次の時限を追加(最後の時限なら月曜1限) */
function addSlot() {
  const last = draft.slots.at(-1);
  const hasNext = last.period < PERIODS.length;
  draft.slots.push(
    hasNext ? { day: last.day, period: last.period + 1 } : { day: DAYS[0], period: 1 }
  );
  renderSlots();
}
/** フォームを開く(c があれば編集、なければ新規) */
function openForm(c, day = DAYS[0], period = 1) {
  // qs = 登録するQ(初期値は今開いているQ)
  const qs = [current().name];
  draft = c
    ? { ...c, qs, slots: [{ day: c.day, period: c.period }] }
    : { id: null, name: '', teacher: '', room: '', colorIdx: 0, qs, slots: [{ day, period }] };
  $('fName').value = draft.name;
  $('fTeacher').value = draft.teacher || '';
  $('fRoom').value = draft.room || '';
  setVisible('fNameError', false);
  setVisible('deleteBtn', !!c, 'inline-block');
  $('modalTitle').textContent = c ? '講義を編集' : '講義を登録';
  renderQs();
  renderSlots();
  renderColors();
  openModal('overlay');
}
function saveForm() {
  const name = $('fName').value.trim();
  if (!name) {
    setVisible('fNameError', true);
    return;
  }
  const info = {
    name,
    teacher: $('fTeacher').value.trim(),
    room: $('fRoom').value.trim(),
    colorIdx: draft.colorIdx,
  };
  const slots = [...new Map(draft.slots.map(s => [s.day + s.period, s])).values()];
  // 編集中の講義は、いったん今のQから外す(Qを変えた場合は移動になる)
  if (draft.id) current().courses = courses().filter(c => c.id !== draft.id);
  // 選んだQすべてに登録する(同じコマの既存の講義は置き換える)
  patterns.filter(p => p.year === current().year && draft.qs.includes(p.name)).forEach(p => {
    const rest = p.courses.filter(
      c => !slots.some(s => s.day === c.day && s.period === c.period)
    );
    const added = slots.map((s, i) => ({
      id: i === 0 && draft.id && p === current() ? draft.id : uid(),
      ...s,
      ...info,
    }));
    p.courses = [...rest, ...added];
  });
  update();
  closeModal('overlay');
}
function deleteFromForm() {
  deleteCourses([draft.id], 'overlay');
}
/* ===== 講義の詳細 ===== */
function openView(c) {
  viewing = c;
  const p = PERIODS.find(x => x.id === c.period);
  $('viewName').textContent = c.name;
  $('viewTeacher').textContent = c.teacher || '(未設定)';
  $('viewRoom').textContent = c.room || '(未設定)';
  $('viewTime').textContent = `${c.day}曜日 ${p.label}(${p.time})`;
  openModal('viewOverlay');
}
function editViewing() {
  closeModal('viewOverlay');
  openForm(viewing);
}
function deleteViewing() {
  if (confirm(`「${viewing.name}」を削除しますか?`)) deleteCourses([viewing.id], 'viewOverlay');
}

/* ========================================== */
/* ===== 送信/受信(ユーザIDで相手を指定して送る) ===== */
/* ========================================== */
// ※ユーザIDは仮実装(この端末に保存するランダムID)。ログイン機能ができたら myId() だけ差し替える
const API = 'timetable.php';
const ID_KEY = 'timetable:userId';
const NAME_KEY = 'timetable:userName';
const CONTACTS_KEY = 'timetable:contacts';
const ID_PATTERN = /^U-[0-9A-Z]{6}$/;
let sendYear;        // 送る年度
let sendQs = [];     // 送るQ(sendYear の中から選ぶ)
let selectedTo = new Set();   // 送信先に選んだ相手のID(ユーザ一覧で選択)
let contactDraft = new Set(); // ユーザ一覧モーダルで選択中(「決定」で selectedTo に反映)
let contacts = [];   // 送ったことのある相手のID(新しい順)
let names = {};      // ID → 相手の表示名
let inbox = [];      // 受信一覧 [{ id, name, date, qs, data }]
let inboxView = null; // 表示中 { index, qName }

function myId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = 'U-' + Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}
/** API呼び出し(bodyがあればPOST)。失敗時は Error を投げる */
async function api(action, { query = {}, body } = {}) {
  const params = new URLSearchParams({ action, me: myId(), ...query });
  const res = await fetch(`${API}?${params}`, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || '通信に失敗しました。');
  return json;
}
/* ----- 相手リスト(この端末に保存) ----- */
function loadContacts() {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY)) || []; } catch (e) { return []; }
}
function saveContacts() {
  try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts)); } catch (e) {}
}
/* ----- モーダルとタブ ----- */
async function openExchangeModal() {
  contacts = loadContacts();
  sendYear = current().year;
  sendQs = [current().name];
  $('myIdText').textContent = myId();
  $('myName').value = localStorage.getItem(NAME_KEY) || '';
  $('toId').value = '';
  selectedTo = new Set();
  setSendMsg('');
  showExchangeTab('send');
  renderContacts();
  renderSendYears();
  renderSendQs();
  openModal('exchangeOverlay');
  await refreshExchange();
}
function showExchangeTab(tab) {
  $('sendPane').style.display = tab === 'send' ? 'block' : 'none';
  $('receivePane').style.display = tab === 'receive' ? 'block' : 'none';
  $('tabSend').classList.toggle('on', tab === 'send');
  $('tabReceive').classList.toggle('on', tab === 'receive');
  if (tab === 'receive') renderInbox();
}
/** 受信一覧と相手の名前を取り直す */
async function refreshExchange() {
  try {
    inbox = await api('inbox');
    // 送ってくれた人は、返信しやすいよう相手リストにも入れる
    inbox.forEach(m => { if (!contacts.includes(m.id)) contacts.push(m.id); });
    saveContacts();
    names = await api('names', { query: { ids: contacts.join(',') } });
    inbox.forEach(m => { if (m.name) names[m.id] = m.name; });
    renderContacts();
    if (inboxView === null) renderInbox();
  } catch (e) {
    $('receiveContent').innerHTML = '<p class="share-empty error">取得に失敗しました。PHPサーバーの起動状況を確認してください。</p>';
  }
}
function copyMyId(btn) {
  try { navigator.clipboard.writeText(myId()); } catch (e) {}
  btn.textContent = 'コピーしました';
  setTimeout(() => (btn.textContent = 'コピー'), 1200);
}
/* ----- 送信タブ ----- */
function setSendMsg(text, ok) {
  $('sendMsg').textContent = text;
  $('sendMsg').className = 'send-msg' + (text ? (ok ? ' ok' : ' err') : '');
}
function renderSendYears() {
  $('sendYearRow').innerHTML = years().map(y => `
    <button type="button" class="chip${y === sendYear ? ' on' : ''}"
            onclick="setSendYear(${y})">${esc(yearLabel(y))}</button>`).join('');
}
function setSendYear(y) {
  sendYear = y;
  renderSendYears();
}
function renderSendQs() {
  $('sendQRow').innerHTML = Q_NAMES.map(q => `
    <button type="button" class="chip${sendQs.includes(q) ? ' on' : ''}"
            onclick="toggleSendQ('${q}')">${q}</button>`).join('');
}
function toggleSendQ(q) {
  sendQs = sendQs.includes(q) ? sendQs.filter(x => x !== q) : [...sendQs, q];
  renderSendQs();
}
/** ユーザ一覧ボタンと、選んだ送信先の表示を更新(一度でも登録した相手がいれば一覧ボタンを出す) */
function renderContacts() {
  $('contactBtn').style.display = contacts.length ? 'block' : 'none';
  $('contactBtn').textContent = `ユーザ一覧から選ぶ(${contacts.length}人)`;
  $('selectedList').innerHTML = selectedTo.size
    ? `<div class="chips">${[...selectedTo].map(id => `
        <span class="tag">${esc(names[id] || id)}
          <button type="button" aria-label="送信先から外す" onclick="unselectTo('${esc(id)}')">×</button>
        </span>`).join('')}</div>`
    : '';
  renderContactList();
}
function unselectTo(id) {
  selectedTo.delete(id);
  renderContacts();
}
/* ----- ユーザ一覧モーダル(名前を表示し、チェックボックスで送る相手を選ぶ) ----- */
function openContactModal() {
  contactDraft = new Set(selectedTo);
  renderContactList();
  openModal('contactOverlay');
}
function renderContactList() {
  $('contactList').innerHTML = contacts.map(id => `
    <label class="contact">
      <input type="checkbox" ${contactDraft.has(id) ? 'checked' : ''}
             onchange="toggleContactDraft('${esc(id)}', this.checked)">
      <div class="contact-name">
        <div class="receive-sender">${esc(names[id] || '(名前不明)')}</div>
        <div class="receive-date">${esc(id)}</div>
      </div>
      <button type="button" class="removeSlotBtn" aria-label="この相手を一覧から削除"
              onclick="event.preventDefault(); removeContact('${esc(id)}')">×</button>
    </label>`).join('') || '<p class="share-empty">登録された相手はいません</p>';
}
function toggleContactDraft(id, on) {
  on ? contactDraft.add(id) : contactDraft.delete(id);
}
function applyContacts() {
  selectedTo = new Set([...contactDraft]);
  closeModal('contactOverlay');
  renderContacts();
}
function removeContact(id) {
  contacts = contacts.filter(x => x !== id);
  selectedTo.delete(id);
  contactDraft.delete(id);
  saveContacts();
  renderContacts();
}
/** 入力したID + ユーザ一覧で選んだ相手、すべてに送る */
async function executeSend() {
  const name = $('myName').value.trim();
  const typed = $('toId').value.trim().toUpperCase();
  const qs = Q_NAMES.filter(q => sendQs.includes(q));
  if (!name) return setSendMsg('あなたの表示名を入力してください');
  if (typed && !ID_PATTERN.test(typed)) return setSendMsg('相手のユーザIDの形式が正しくありません(例 U-3C9D1X)');
  const targets = [...new Set([...selectedTo, ...(typed ? [typed] : [])])];
  if (!targets.length) return setSendMsg('送りたい相手のIDを入力するか、ユーザ一覧から選んでください');
  if (targets.includes(myId())) return setSendMsg('自分自身には送れません');
  if (!qs.length) return setSendMsg('送るクォーターを1つ以上選んでください');
  localStorage.setItem(NAME_KEY, name);
  const data = patterns
    .filter(p => p.year === sendYear && qs.includes(p.name))
    .map(p => ({ year: p.year, yearName: yearNames[p.year] || '', name: p.name, courses: p.courses }));
  const results = await Promise.allSettled(
    targets.map(to => api('send', { body: { to, name, data } }))
  );
  const label = to => names[to] || to;
  const okIds = targets.filter((_, i) => results[i].status === 'fulfilled');
  const ngIds = targets.filter((_, i) => results[i].status === 'rejected');
  okIds.forEach(to => { contacts = [to, ...contacts.filter(x => x !== to)].slice(0, 30); });
  saveContacts();
  if (okIds.includes(typed)) $('toId').value = '';
  if (ngIds.length) {
    setSendMsg(`${ngIds.map(label).join('、')} への送信に失敗しました`);
  } else {
    setSendMsg(`${okIds.map(label).join('、')} に ${yearLabel(sendYear)} ${qs.join('・')} を送信しました`, true);
  }
  renderContacts();
  refreshExchange();
}
/* ----- 受信タブ(表示するだけ) ----- */
function renderInbox() {
  inboxView = null;
  $('receiveContent').innerHTML = inbox.length
    ? `<div class="receive-list">${inbox.map((m, i) => `
        <div class="receive-item" onclick="openInbox(${i})">
          <div>
            <div class="receive-sender">👤 ${esc(m.name || m.id)}</div>
            <div class="receive-date">${esc(m.id)} ・ ${esc(summarize(m.data))}</div>
          </div>
          <div class="receive-date">${esc(m.date)}</div>
        </div>`).join('')}</div>`
    : '<p class="share-empty">受信した時間割はありません</p>';
}
/** 「2026年度 1Q 2Q / 2025年度 3Q」のような要約(送り主が付けた年度名があればそれを使う) */
function summarize(data) {
  const byYear = {};
  data.forEach(q => (byYear[q.year] ||= { label: q.yearName || `${q.year}年度`, qs: [] }).qs.push(q.name));
  return Object.values(byYear).map(y => `${y.label} ${y.qs.join(' ')}`).join(' / ');
}
const qKey = q => `${q.year}-${q.name}`;
function openInbox(i) {
  inboxView = { index: i, key: inbox[i].data[0] && qKey(inbox[i].data[0]) };
  renderInboxView();
}
function showInboxQ(key) {
  inboxView.key = key;
  renderInboxView();
}
function renderInboxView() {
  const m = inbox[inboxView.index];
  const q = m.data.find(x => qKey(x) === inboxView.key);
  $('receiveContent').innerHTML = `
    <button class="btn btn-ghost" style="margin-bottom:10px;" onclick="renderInbox()">← 送信者一覧に戻る</button>
    <div class="receive-sender" style="font-size:16px;">${esc(m.name || m.id)} さんの時間割</div>
    <div class="chips">${m.data.map(x => `
      <button type="button" class="chip${qKey(x) === inboxView.key ? ' on' : ''}"
              onclick="showInboxQ('${esc(qKey(x))}')">${esc(x.yearName || x.year + '年度')} ${esc(x.name)}</button>`).join('')}</div>
    <div style="margin-top:12px;">${q ? previewGridHtml(q.courses || []) : ''}</div>`;
}
/** 表の読み取り専用プレビュー(.preview-grid を使用) */
function previewGridHtml(list) {
  const find = (day, period) => list.find(c => c.day === day && c.period === period);
  const head = DAYS.map(d => `<div class="p-day-head">${d}</div>`).join('');
  const rows = PERIODS.map((p, r) => {
    const zebra = r % 2 ? 'row-odd' : 'row-even';
    const cells = DAYS.map(day => {
      const c = find(day, p.id);
      if (!c) return `<div class="p-cell ${zebra}"></div>`;
      const bg = PALETTE[c.colorIdx] ?? PALETTE[0];
      const room = c.room ? `<div class="c-room">${esc(c.room)}</div>` : '';
      return `<div class="p-cell ${zebra}" style="background:${bg}"><div class="c-name">${esc(c.name)}</div>${room}</div>`;
    }).join('');
    return `<div class="p-period-cell ${zebra}"><div class="p-label">${p.label}</div></div>${cells}`;
  }).join('');
  return `<div class="preview-grid-wrapper"><div class="preview-grid"><div class="corner"></div>${head}${rows}</div></div>`;
}

/* ===== 起動 ===== */
load();
render();
save();