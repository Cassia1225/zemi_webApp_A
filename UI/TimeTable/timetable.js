/* =====================================================================
 * 時間割アプリ
 *  - 1Q〜4Q の4つの時間割(固定)
 *  - 月〜土 × 6時限(固定。各時限の時間だけ編集可能)
 *  - 保存先は localStorage(store を差し替えれば Firebase 等にできる)
 * ===================================================================== */


/* ===== 共通ユーティリティ ===== */

const $ = id => document.getElementById(id);

/** モーダルの表示・非表示(v=1 で表示、0 で非表示) */
const show = (id, v = 1) => $(id).classList.toggle('open', !!v);

/** HTML に埋め込む前の無害化(XSS 対策) */
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');

/** ランダムな ID を作る */
const uid = () => Math.random().toString(36).slice(2, 10);


/* ===== 定数 ===== */

const DAYS = [...'月火水木金土'];

const SLIDE_MS = 160;          // 時間割切り替えアニメの片道の長さ(ms)
const SLIDE_DISTANCE = 12;     // 流れる距離(%)
const SWIPE_MIN_X = 60;        // スワイプと判定する最小の横移動(px)
const SWIPE_RATIO = 1.5;       // 横移動が縦移動の何倍以上ならスワイプとするか

/** 時限の初期値(6時限固定) */
const defPeriods = () =>
  [
    '9:00〜10:40',
    '10:55〜12:35',
    '13:25〜15:05',
    '15:20〜17:00',
    '17:15〜18:55',
    '19:05〜20:45',
  ].map((time, i) => ({ id: i + 1, label: `${i + 1}限`, time }));

/** 講義の色(名前, 背景, 文字)。講義には番号 colorIdx で保存する */
const PALETTE = [
  ['そら',   '#AFD9F5', '#0D3A5C'],
  ['瑠璃',   '#A9BEF2', '#1E2F73'],
  ['若葉',   '#BEE3A8', '#28480F'],
  ['抹茶',   '#D6DE9C', '#4A5219'],
  ['菜の花', '#F3E48F', '#5C4A05'],
  ['杏',     '#F6C99A', '#6B3510'],
  ['朱',     '#F3B49C', '#7A2E10'],
  ['桜',     '#F3C6E2', '#6B2148'],
  ['撫子',   '#EFB6B8', '#7A2020'],
  ['藤',     '#D6C6F0', '#3E2967'],
  ['檜皮',   '#DCC0A0', '#5A3B1D'],
  ['鼠',     '#D9D6CC', '#3A3934'],
].map(([name, bg, text]) => ({ name, bg, text }));


/* ===== 状態 ===== */

let patterns = [];      // 時間割(1Q〜4Q)。各要素は { id, name, courses: [...] }
let activeId;           // 表示中の時間割 ID
let PERIODS = [];       // 時限(id, label, time)

let draft;              // 登録・編集フォームで編集中の内容
let viewing;            // 詳細表示中の講義
let mode = 'view';      // 'view'(確認・登録) / 'delete'(削除)
let sliding = false;    // 切り替えアニメ中か
let menuOpen = false;   // メニューが開いているか

const sel = new Set();  // 削除モードで選択中の講義 ID

/** 表示中の時間割 */
const act = () => patterns.find(p => p.id === activeId);

/** 表示中の時間割の講義一覧 */
const courses = () => act().courses;

/** 曜日 d・時限 p のコマにある講義(なければ undefined) */
const find = (d, p) => courses().find(c => c.day === d && c.period === p);

/** 表示中の時間割が何番目か */
const idx = () => patterns.findIndex(p => p.id === activeId);


/* ===== 保存・読み込み ===== */

/** 保存先。Firebase 等にするときはここだけ差し替える */
const store = {
  get: k => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
};

async function save() {
  try {
    const data = { patterns, activeId, periods: PERIODS };
    await store.set('timetable:data', JSON.stringify(data));
    $('saveError').style.display = 'none';
  } catch (e) {
    $('saveError').style.display = 'block';
  }
}

async function load() {
  // 保存データの読み込み(壊れていたら空として扱う)
  let d = {};
  try {
    d = JSON.parse(await store.get('timetable:data')) || {};
  } catch (e) {}

  // 時限は6時限固定。保存されていた「時間」だけ引き継ぐ
  const saved = d.periods || [];
  PERIODS = defPeriods().map(p => ({
    ...p,
    time: saved.find(s => s.id === p.id)?.time ?? p.time,
  }));

  // 1Q〜4Q を必ず用意する
  patterns = Array.isArray(d.patterns) ? d.patterns : [];
  [1, 2, 3, 4].forEach(n => {
    const exists = patterns.some(p => p.name === `${n}Q`);
    if (!exists) patterns.push({ id: uid(), name: `${n}Q`, courses: [] });
  });

  // 前回表示していた時間割を復元(なければ先頭)
  activeId = patterns.some(p => p.id === d.activeId) ? d.activeId : patterns[0].id;
}

/** 講義を削除して保存・再描画 */
async function deleteCourses(ids) {
  act().courses = courses().filter(c => !ids.includes(c.id));
  await save();
  render();
}


/* ===== 表の描画 ===== */

function render() {
  renderHeader();
  renderGrid();
  $('grid').style.display = 'grid';
  $('loading').style.display = 'none';
}

/** タイトル・矢印・削除ボタンの状態を更新 */
function renderHeader() {
  $('appTitle').textContent = act().name;
  $('prevBtn').disabled = idx() <= 0;
  $('nextBtn').disabled = idx() >= patterns.length - 1;

  // 削除ボタン:未選択なら説明文、選択中なら件数つきの削除ボタン
  $('deleteConfirmBtn').disabled = !sel.size;
  $('deleteConfirmBtn').innerHTML = sel.size
    ? `選択した講義を<wbr>削除(${sel.size}件)`
    : '講義をタップして<wbr>削除する';
}

/** 表(曜日見出し + 時限ごとの行)を組み立てる */
function renderGrid() {
  const today = new Date().getDay() - 1; // 月=0〜土=5(日曜は -1 で強調なし)

  const header =
    '<div class="corner"></div>' +
    DAYS.map((d, k) => `<div class="day-head${k === today ? ' today' : ''}">${d}</div>`).join('');

  const rows = PERIODS.map((p, r) => renderRow(p, r % 2 ? 'row-odd' : 'row-even')).join('');

  $('grid').innerHTML = header + rows;
}

/** 1行 = 時限セル + 曜日ごとのコマ */
function renderRow(period, zebra) {
  const periodCell = `
    <div class="period-cell ${zebra}">
      <div class="p-label">${esc(period.label)}</div>
      <div class="p-time">${esc(period.time)}</div>
    </div>`;

  const cells = DAYS.map(day => renderCell(day, period.id, zebra)).join('');
  return periodCell + cells;
}

/** 1コマ(講義があれば色と名前・教室を表示) */
function renderCell(day, periodId, zebra) {
  const c = find(day, periodId);
  const color = c && PALETTE[c.colorIdx];
  const selected = sel.has(c?.id) ? ' selected-for-delete' : '';
  const style = c ? ` style="background:${color.bg}"` : '';

  let inner = '';
  if (c) {
    inner += `<div class="c-name" style="color:${color.text}">${esc(c.name)}</div>`;
    if (c.room) {
      inner += `<div class="c-room" style="color:${color.text}">${esc(c.room)}</div>`;
    }
  }

  return `<div class="cell ${zebra}${selected}" onclick="tapCell('${day}', ${periodId})"${style}>${inner}</div>`;
}

/** コマをタップしたとき:削除モードは選択の切り替え、通常は詳細 or 新規登録 */
function tapCell(d, p) {
  const c = find(d, p);

  if (mode === 'delete') {
    if (!c) return;
    sel.has(c.id) ? sel.delete(c.id) : sel.add(c.id);
    render();
  } else if (c) {
    openView(c);
  } else {
    openForm(null, d, p);
  }
}

function setMode(v) {
  mode = v;
  sel.clear();
  document.body.classList.toggle('delete-mode', v === 'delete');
  render();
}

function deleteSelected() {
  if (!confirm(`選択した${sel.size}件の講義を削除しますか?`)) return;
  const ids = [...sel];
  sel.clear();
  deleteCourses(ids);
}


/* ===== 時間割の切り替え(矢印・スワイプ・メニュー) ===== */

/** 表を横へ流して消す → 中身を入れ替える → 反対側から戻す */
async function slide(dir, apply) {
  const g = $('grid');

  const go = (x0, x1, o0, o1) =>
    g.animate(
      [
        { transform: `translateX(${x0}%)`, opacity: o0 },
        { transform: `translateX(${x1}%)`, opacity: o1 },
      ],
      { duration: SLIDE_MS, fill: 'forwards' }
    ).finished;

  await go(0, -dir * SLIDE_DISTANCE, 1, 0);  // 流れて消える
  apply();                                   // 中身を入れ替え
  await go(dir * SLIDE_DISTANCE, 0, 0, 1);   // 反対側から戻る

  g.getAnimations().forEach(a => a.cancel());
}

/** 指定の時間割に切り替える */
async function activate(id) {
  setMenu(false);
  if (id === activeId || sliding) return;

  const dir = patterns.findIndex(p => p.id === id) > idx() ? 1 : -1;
  const apply = () => {
    activeId = id;
    sel.clear();
    render();
  };

  sliding = true;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) apply();          // 「動きを減らす」設定ならアニメなし
  else await slide(dir, apply);
  sliding = false;

  save();
}

/** 前(-1)・次(1)の時間割へ */
const step = d => patterns[idx() + d] && activate(patterns[idx() + d].id);

/* スワイプ:指を置いた位置と離した位置の差で判定 */
let sx, sy;

$('gridScroll').addEventListener(
  'touchstart',
  e => {
    sx = e.touches.length === 1 ? e.touches[0].clientX : null; // 複数本指は無視
    sy = e.touches[0].clientY;
  },
  { passive: true }
);

$('gridScroll').addEventListener(
  'touchend',
  e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;

    const isSwipe = sx != null && Math.abs(dx) > SWIPE_MIN_X && Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO;
    if (isSwipe) step(dx < 0 ? 1 : -1);
  },
  { passive: true }
);


/* ===== メニュー(設定・時間割の一覧) ===== */

function setMenu(v) {
  menuOpen = v;
  $('patternMenu').classList.toggle('open', v);
  if (!v) return;

  const items = patterns
    .map(p => `
      <div class="pattern-row${p.id === activeId ? ' active' : ''}">
        <button class="pattern-name-btn" onclick="activate('${p.id}')">${esc(p.name)}</button>
      </div>`)
    .join('');

  $('patternMenu').innerHTML = `
    <button class="pattern-menu-item" onclick="setMenu(false); openSettings()">設定</button>
    <div class="pattern-menu-sep"></div>
    <div class="pattern-menu-label">時間割</div>
    ${items}`;
}

// メニューの外をクリックしたら閉じる
document.addEventListener('click', e => {
  if (menuOpen && !e.target.closest('.menu-wrap')) setMenu(false);
});


/* ===== 講義の登録・編集フォーム ===== */

/** 曜日・時限のプルダウン(2行以上あるときは「×」で行を消せる) */
function slotsUI() {
  $('slotsList').innerHTML = draft.slots
    .map((s, i) => {
      const dayOptions = DAYS
        .map(d => `<option${d === s.day ? ' selected' : ''}>${d}</option>`)
        .join('');

      const periodOptions = PERIODS
        .map(p => `<option value="${p.id}"${p.id === s.period ? ' selected' : ''}>${esc(p.label)}</option>`)
        .join('');

      const removeBtn = draft.slots.length > 1
        ? `<button class="removeSlotBtn" aria-label="このコマを削除"
             onclick="draft.slots.splice(${i}, 1); slotsUI()">×</button>`
        : '';

      return `
        <div class="slot-row">
          <select onchange="draft.slots[${i}].day = this.value">${dayOptions}</select>
          <select onchange="draft.slots[${i}].period = +this.value">${periodOptions}</select>
          ${removeBtn}
        </div>`;
    })
    .join('');
}

/** 色の選択パレット */
function colorUI() {
  $('colorRow').innerHTML = PALETTE
    .map((c, i) => `
      <div class="swatch${i === draft.colorIdx ? ' selected' : ''}"
           style="background:${c.bg}"
           title="${c.name}"
           onclick="draft.colorIdx = ${i}; colorUI()"></div>`)
    .join('');
}

/** 直前のコマの次の時限を追加(最後の時限なら月曜1限)。重複は保存時にまとめられる */
function addSlot() {
  const last = draft.slots.at(-1);
  const next = PERIODS[PERIODS.findIndex(p => p.id === last.period) + 1];

  draft.slots.push(
    next
      ? { day: last.day, period: next.id }
      : { day: DAYS[0], period: PERIODS[0].id }
  );
  slotsUI();
}

/** フォームを開く(c があれば編集、なければ新規) */
function openForm(c, day = DAYS[0], period = PERIODS[0].id) {
  draft = c
    ? { ...c, slots: [{ day: c.day, period: c.period }] }
    : { id: null, name: '', teacher: '', room: '', colorIdx: 0, slots: [{ day, period }] };

  $('fName').value = draft.name;
  $('fTeacher').value = draft.teacher || '';
  $('fRoom').value = draft.room || '';
  $('fNameError').style.display = 'none';
  $('deleteBtn').style.display = c ? 'inline-block' : 'none';
  $('modalTitle').textContent = c ? '講義を編集' : '講義を登録';

  slotsUI();
  colorUI();
  show('overlay');
}

/**
 * フォームを保存する
 *  - 講義名は必須
 *  - 同じコマの既存講義は上書き
 *  - 複数コマは1コマずつ別の講義として保存(編集時は先頭のコマが元の講義)
 */
async function saveForm() {
  const f = {
    name: $('fName').value.trim(),
    teacher: $('fTeacher').value.trim(),
    room: $('fRoom').value.trim(),
    colorIdx: draft.colorIdx,
  };

  if (!f.name) {
    $('fNameError').style.display = 'block';
    return;
  }

  // 同じコマの重複は後勝ち
  const slots = [...new Map(draft.slots.map(s => [s.day + s.period, s])).values()];

  // 編集中の講義自身と、これから上書きするコマの講義を取り除く
  const rest = courses().filter(
    c => c.id !== draft.id && !slots.some(s => s.day === c.day && s.period === c.period)
  );

  const added = slots.map((s, i) => ({
    id: draft.id && i === 0 ? draft.id : uid(),
    ...s,
    ...f,
  }));

  act().courses = [...rest, ...added];
  await save();
  render();
  show('overlay', 0);
}


/* ===== 講義の詳細 ===== */

function openView(c) {
  viewing = c;
  const p = PERIODS.find(x => x.id === c.period);

  $('viewName').textContent = c.name;
  $('viewTeacher').textContent = c.teacher || '(未設定)';
  $('viewRoom').textContent = c.room || '(未設定)';
  $('viewTime').textContent = `${c.day}曜日 ${p.label}${p.time ? `(${p.time})` : ''}`;

  show('viewOverlay');
}

function deleteViewing() {
  if (!confirm(`「${viewing.name}」を削除しますか?`)) return;
  deleteCourses([viewing.id]);
  show('viewOverlay', 0);
}


/* ===== 設定(時限の時間) ===== */

function openSettings() {
  $('periodsList').innerHTML = PERIODS
    .map(p => `
      <div class="settings-period-row">
        <span class="period-label">${esc(p.label)}</span>
        <input value="${esc(p.time)}" placeholder="9:00〜10:40"
               onchange="setTime(${p.id}, this.value)">
      </div>`)
    .join('');

  show('settingsOverlay');
}

function setTime(id, v) {
  PERIODS.find(p => p.id === id).time = v.trim();
  render();
  save();
}


/* ===== 起動 ===== */

load().then(() => {
  render();
  save();
});