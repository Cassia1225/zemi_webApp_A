/* -------------------------------------------------------------
   マインドフルネス瞑想・実施サポート ロジック
------------------------------------------------------------- */
const breathingPatterns = {
    mindfulness: [
        { label: "自然に吸う", duration: 5, scale: 1.5, color: "#e6e8df" },
        { label: "自然に吐く", duration: 6, scale: 1.0, color: "#ecece6" }
    ],
    box: [
        { label: "鼻から吸う", duration: 4, scale: 1.8, color: "#e3e5dc" },
        { label: "息を止める", duration: 4, scale: 1.8, color: "#dcded4" },
        { label: "口から吐く", duration: 4, scale: 1.0, color: "#ecece6" },
        { label: "息を止める", duration: 4, scale: 1.0, color: "#ecece6" }
    ],
    "478": [
        { label: "鼻から吸う", duration: 4, scale: 1.8, color: "#e3e5dc" },
        { label: "息を止める", duration: 7, scale: 1.8, color: "#dcded4" },
        { label: "ゆっくり吐く", duration: 8, scale: 1.0, color: "#ecece6" }
    ]
};

// 時間経過に応じて表示するマインドフルネス・サポートガイド
const mindfulnessCues = [
    { ratio: 1.0,  text: "まずは目を軽く閉じるか、一点をぼんやり見つめましょう。" },
    { ratio: 0.86, text: "鼻先を通る空気の温度や、お腹の動きをただ観察します。" },
    { ratio: 0.72, text: "過去でも未来でもない、今ココに集中しましょう。" },
    { ratio: 0.54, text: "作業の考えが浮かんでも大丈夫。気づいたら呼吸へ意識を戻しましょう。" },
    { ratio: 0.34, text: "肩や奥歯の噛みしめが力んでいたら、吐く息と一緒に緩めます。" },
    { ratio: 0.15, text: "もう少しで終わります。今の体の感覚を静かに味わいます。" }
];

let totalSeconds = 60;
let remainingSeconds = 60;
let isRunning = false;
let mainTimer = null;
let phaseTimeout = null;
let phaseCountdownTimer = null;
let currentPhaseIndex = 0;
let lastCueIndex = -1;

const circle = document.getElementById('breathing-circle');
const guideText = document.getElementById('guide-text');
const phaseTimerEl = document.getElementById('phase-timer');
const remainingTimeEl = document.getElementById('remaining-time');
const supportMessageEl = document.getElementById('support-message');
const startBtn = document.getElementById('start-btn');
const modeSelect = document.getElementById('breathing-mode');
const soundCheckbox = document.getElementById('sound-enabled');

let audioCtx = null;

function playBell(freq = 432, duration = 1.6) {
    if (!soundCheckbox.checked) return;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
}

function updateRemainingDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    remainingTimeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateSupportCue() {
    const ratio = remainingSeconds / totalSeconds;
    for (let i = mindfulnessCues.length - 1; i >= 0; i--) {
        if (ratio <= mindfulnessCues[i].ratio) {
            if (lastCueIndex !== i) {
                lastCueIndex = i;
                supportMessageEl.textContent = mindfulnessCues[i].text;
            }
            break;
        }
    }
}

function setDuration(minutes, btnElement) {
    resetMeditation();
    totalSeconds = minutes * 60;
    remainingSeconds = totalSeconds;
    updateRemainingDisplay();

    document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
}

function runBreathingPhase() {
    if (!isRunning) return;

    const mode = modeSelect.value;
    const pattern = breathingPatterns[mode];
    const phase = pattern[currentPhaseIndex];

    if (mode !== 'mindfulness') {
        playBell(phase.label.includes("吸う") ? 396 : 330, 1.2);
    }

    guideText.textContent = phase.label;
    circle.style.transitionDuration = `${phase.duration}s`;
    circle.style.transform = `scale(${phase.scale})`;
    circle.style.backgroundColor = phase.color;

    let phaseSec = phase.duration;
    phaseTimerEl.textContent = mode === 'mindfulness' ? "" : phaseSec;

    clearInterval(phaseCountdownTimer);
    if (mode !== 'mindfulness') {
        phaseCountdownTimer = setInterval(() => {
            phaseSec--;
            phaseTimerEl.textContent = phaseSec > 0 ? phaseSec : "";
        }, 1000);
    }

    phaseTimeout = setTimeout(() => {
        currentPhaseIndex = (currentPhaseIndex + 1) % pattern.length;
        runBreathingPhase();
    }, phase.duration * 1000);
}

function toggleMeditation() {
    if (isRunning) {
        pauseMeditation();
    } else {
        startMeditation();
    }
}

function startMeditation() {
    if (remainingSeconds <= 0) {
        remainingSeconds = totalSeconds;
    }
    isRunning = true;
    startBtn.textContent = "一時停止";
    modeSelect.disabled = true;

    playBell(432, 2.0);
    updateSupportCue();
    runBreathingPhase();

    mainTimer = setInterval(() => {
        remainingSeconds--;
        updateRemainingDisplay();
        updateSupportCue();

        if (remainingSeconds <= 0) {
            finishMeditation();
        }
    }, 1000);
}

function pauseMeditation() {
    isRunning = false;
    startBtn.textContent = "再開する";
    modeSelect.disabled = false;

    clearInterval(mainTimer);
    clearTimeout(phaseTimeout);
    clearInterval(phaseCountdownTimer);

    guideText.textContent = "一時停止中";
    phaseTimerEl.textContent = "";
    circle.style.transitionDuration = "0.5s";
    circle.style.transform = "scale(1)";
}

function resetMeditation() {
    isRunning = false;
    clearInterval(mainTimer);
    clearTimeout(phaseTimeout);
    clearInterval(phaseCountdownTimer);

    currentPhaseIndex = 0;
    lastCueIndex = -1;

    remainingSeconds = totalSeconds;
    updateRemainingDisplay();

    startBtn.textContent = "瞑想をはじめる";
    modeSelect.disabled = false;
    guideText.textContent = "準備ができたら開始";
    phaseTimerEl.textContent = "";
    supportMessageEl.textContent = "背筋を軽く伸ばし、肩の力を抜いて座りましょう。";

    circle.style.transitionDuration = "0.4s";
    circle.style.transform = "scale(1)";
    circle.style.backgroundColor = "#ecece6";
}

function finishMeditation() {
    resetMeditation();
    guideText.textContent = "お疲れさまでした";
    supportMessageEl.textContent = "ゆっくりと目を開け、軽く伸びをしてから作業に戻りましょう。";
    playBell(528, 2.8);
}

updateRemainingDisplay();