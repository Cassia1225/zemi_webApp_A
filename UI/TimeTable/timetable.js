/* 時間割アプリ:1Q〜4Q × 月〜土 × 6時限(時間は固定)。保存先は localStorage */
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
/* ===== 状態 ===== */
let patterns = [];          // 時間割 [{ id, name: '1Q', courses: [...] }, ...]
let activeId;               // 表示中の時間割の ID
let draft;                  // 登録・編集フォームの下書き
let viewing;                // 詳細表示中の講義
let receivedMessages = [];  // APIから取得した受信一覧
let currentPreviewContext = null; // 現在プレビュー中の { sender, qName, courses }
const selected = new Set(); // 削除モードで選択中の講義 ID
const current = () => patterns.find(p => p.id === activeId);
const courses = () => current().courses;
const findCourse = (day, period) => courses().find(c => c.day === day && c.period === period);
/* ===== 保存・読み込み ===== */
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ patterns, activeId }));
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
  // 1Q〜4Q を必ず用意する
  for (let n = 1; n <= 4; n++) {
    if (!patterns.some(p => p.name === `${n}Q`)) {
      patterns.push({ id: uid(), name: `${n}Q`, courses: [] });
    }
  }
  activeId = patterns.some(p => p.id === saved.activeId) ? saved.activeId : patterns[0].id;
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
  const index = patterns.indexOf(current());
  $('appTitle').textContent = current().name;
  $('prevBtn').disabled = index === 0;
  $('nextBtn').disabled = index === patterns.length - 1;
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
/* ===== 時間割の切り替え(矢印・スワイプ) ===== */
function step(dir) {
  const next = patterns[patterns.indexOf(current()) + dir];
  if (!next) return;
  activeId = next.id;
  selected.clear();
  update();
}
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
// モーダルの外側をクリックしたら閉じる
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
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
  draft = c
    ? { ...c, slots: [{ day: c.day, period: c.period }] }
    : { id: null, name: '', teacher: '', room: '', colorIdx: 0, slots: [{ day, period }] };
  $('fName').value = draft.name;
  $('fTeacher').value = draft.teacher || '';
  $('fRoom').value = draft.room || '';
  setVisible('fNameError', false);
  setVisible('deleteBtn', !!c, 'inline-block');
  $('modalTitle').textContent = c ? '講義を編集' : '講義を登録';
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
  const rest = courses().filter(
    c => c.id !== draft.id && !slots.some(s => s.day === c.day && s.period === c.period)
  );
  const added = slots.map((s, i) => ({
    id: i === 0 && draft.id ? draft.id : uid(),
    ...s,
    ...info,
  }));
  current().courses = [...rest, ...added];
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
/* ===== PHP API 連携: 送受信・上書き機能 ===== */
/* ========================================== */

function openSendModal() {
  setVisible('sendSenderError', false);
  openModal('sendOverlay');
}

async function executeSend() {
  const sender = $('sendSenderName').value.trim();
  if (!sender) {
    setVisible('sendSenderError', true);
    return;
  }

  const selectedQs = Array.from(document.querySelectorAll('input[name="sendQ"]:checked')).map(el => el.value);
  if (selectedQs.length === 0) {
    alert('送信するQを1つ以上選択してください。');
    return;
  }

  const sendData = patterns
    .filter(p => selectedQs.includes(p.name))
    .map(p => ({ name: p.name, courses: p.courses }));

  try {
    const res = await fetch('timetable.php?action=send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender, data: sendData })
    });
    const result = await res.json();
    if (result.success) {
      alert(`${selectedQs.join(', ')} の時間割を送信しました。`);
      closeModal('sendOverlay');
    } else {
      alert(result.error || '送信に失敗しました。');
    }
  } catch (e) {
    alert('通信エラーが発生しました。PHPサーバーの起動状況を確認してください。');
  }
}

async function openReceiveModal() {
  openModal('receiveOverlay');
  $('receiveModalTitle').textContent = '受信中...';
  $('receiveContent').innerHTML = '<p style="padding:16px;">データを読み込んでいます...</p>';
  $('overwriteBtn').style.display = 'none';

  try {
    const res = await fetch('api.php?action=receive');
    receivedMessages = await res.json();
    showSenderList();
  } catch (e) {
    $('receiveContent').innerHTML = '<p style="padding:16px; color:#B23A3A;">受信用データの取得に失敗しました。</p>';
  }
}

/** 1. 送信者一覧を表示 */
function showSenderList() {
  $('receiveModalTitle').textContent = '受信した時間割';
  $('overwriteBtn').style.display = 'none';
  currentPreviewContext = null;

  if (!receivedMessages.length) {
    $('receiveContent').innerHTML = '<p style="padding:16px;">受信したデータはありません。</p>';
    return;
  }

  const listHtml = receivedMessages.map((msg, index) => `
    <div class="receive-item" onclick="showQList(${index})">
      <div class="receive-sender">👤 ${esc(msg.sender)}</div>
      <div class="receive-date">${esc(msg.date)}</div>
    </div>
  `).join('');

  $('receiveContent').innerHTML = `<div class="receive-list">${listHtml}</div>`;
}

/** 2. 送信されたQ一覧を表示 */
function showQList(msgIndex) {
  const msg = receivedMessages[msgIndex];
  $('receiveModalTitle').textContent = `${msg.sender} さんの時間割`;
  $('overwriteBtn').style.display = 'none';

  const qHtml = msg.data.map((q, qIndex) => `
    <div class="receive-item" onclick="showQPreview(${msgIndex}, ${qIndex})">
      <div class="receive-sender">📅 ${esc(q.name)} の時間割 (${q.courses.length}コマ)</div>
      <div style="font-size:12px; color:#24344D; font-weight:700;">プレビュー表示 →</div>
    </div>
  `).join('');

  $('receiveContent').innerHTML = `
    <button class="btn btn-ghost" style="margin-bottom:10px;" onclick="showSenderList()">← 送信者一覧に戻る</button>
    <div class="receive-list">${qHtml}</div>
  `;
}

/** 3. グリッドプレビュー表示 */
function showQPreview(msgIndex, qIndex) {
  const msg = receivedMessages[msgIndex];
  const targetQ = msg.data[qIndex];

  $('receiveModalTitle').textContent = `${msg.sender} - ${targetQ.name} プレビュー`;
  $('overwriteBtn').style.display = 'inline-block';

  currentPreviewContext = {
    sender: msg.sender,
    qName: targetQ.name,
    courses: targetQ.courses
  };

  const previewCourses = targetQ.courses || [];
  const findPreviewCourse = (day, period) => previewCourses.find(c => c.day === day && c.period === period);

  const headHtml = DAYS.map(d => `<div class="p-day-head">${d}</div>`).join('');

  const rowsHtml = PERIODS.map((p, r) => {
    const zebra = r % 2 ? 'row-odd' : 'row-even';
    const periodCell = `
      <div class="p-period-cell ${zebra}">
        <div class="p-label">${p.label}</div>
      </div>`;

    const dayCells = DAYS.map(day => {
      const c = findPreviewCourse(day, p.id);
      if (!c) return `<div class="p-cell ${zebra}"></div>`;

      const bg = PALETTE[c.colorIdx] ?? PALETTE[0];
      const name = `<div class="c-name">${esc(c.name)}</div>`;
      const room = c.room ? `<div class="c-room">${esc(c.room)}</div>` : '';

      return `<div class="p-cell ${zebra}" style="background:${bg}">${name}${room}</div>`;
    }).join('');

    return periodCell + dayCells;
  }).join('');

  const gridHtml = `
    <button class="btn btn-ghost" style="margin-bottom:10px;" onclick="showQList(${msgIndex})">← Q一覧に戻る</button>
    <div class="preview-grid-wrapper">
      <div class="preview-grid">
        <div class="corner"></div>
        ${headHtml}
        ${rowsHtml}
      </div>
    </div>
  `;

  $('receiveContent').innerHTML = gridHtml;
}

/** 上書き実行 */
function confirmOverwrite() {
  if (!currentPreviewContext) return;

  const { qName, courses: newCourses } = currentPreviewContext;

  if (confirm(`自分の 「${qName}」 の時間割を、受信した内容で上書きしますか？\n（※元の${qName}の情報は置き換わります）`)) {
    const targetPattern = patterns.find(p => p.name === qName);
    if (targetPattern) {
      targetPattern.courses = JSON.parse(JSON.stringify(newCourses));
      update();
      alert(`「${qName}」 の時間割を上書きしました。`);
      closeModal('receiveOverlay');
    }
  }
}

/* ===== 起動 ===== */
load();
render();
save();