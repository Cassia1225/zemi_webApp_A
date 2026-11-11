/* -------------------------------------------------------------
   1. MP3音源の再生・停止・音量変更
------------------------------------------------------------- */
const musicSelect = document.getElementById('music-select');
const playBtn = document.getElementById('play-btn');
const volumeContainer = document.getElementById('volume-container');
const volumeSlider = document.getElementById('volume-slider');
const bgmPlayer = document.getElementById('bgm-player');
const alarmPlayer = document.getElementById('alarm-player');

// ドロップダウン選択時の処理
musicSelect.addEventListener('change', () => {
    if (musicSelect.value === 'none') {
        stopSound();
        volumeContainer.style.display = 'none';
    } else {
        volumeContainer.style.display = 'block';
        bgmPlayer.src = musicSelect.value; // 選択されたMP3ファイルをセット
        if (!bgmPlayer.paused) {
            bgmPlayer.play();
        }
    }
});

// 再生/一時停止ボタンの処理
playBtn.addEventListener('click', () => {
    if (musicSelect.value === 'none') {
        alert('リラックスミュージックを選択してください。');
        return;
    }
    if (bgmPlayer.paused) {
        playSound();
    } else {
        stopSound();
    }
});

// 音量スライダーの処理
volumeSlider.addEventListener('input', (e) => {
    bgmPlayer.volume = e.target.value;
});

function playSound() {
    if (musicSelect.value !== 'none') {
        bgmPlayer.src = musicSelect.value;
        bgmPlayer.volume = volumeSlider.value;
        bgmPlayer.play();
        playBtn.textContent = '一時停止';
    }
}

function stopSound() {
    bgmPlayer.pause();
    playBtn.textContent = '再生';
}

/* -------------------------------------------------------------
   2. 休憩時間タイマー
------------------------------------------------------------- */
let timerInterval = null;
let totalSeconds = 0;
let remainingSeconds = 0;
let isTimerRunning = false;

const timerDisplay = document.getElementById('timer-display');
const timerStartBtn = document.getElementById('timer-start-btn');

function updateDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function setTimer(minutes) {
    pauseTimer();
    totalSeconds = minutes * 60;
    remainingSeconds = totalSeconds;
    document.getElementById('custom-time').value = "";
    updateDisplay();
}

function setCustomTimer(minutes) {
    if (!minutes) return;
    setTimer(parseInt(minutes));
}

function toggleTimer() {
    if (remainingSeconds <= 0) return;
    if (isTimerRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (isTimerRunning || remainingSeconds <= 0) return;
    isTimerRunning = true;
    timerStartBtn.textContent = '一時停止';

    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateDisplay();

        if (remainingSeconds <= 0) {
            pauseTimer();
            alarmPlayer.play(); // 時間終了時にアラームMP3を再生
        }
    }, 1000);
}

function pauseTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
    timerStartBtn.textContent = 'スタート';
}

function resetTimer() {
    pauseTimer();
    remainingSeconds = totalSeconds;
    updateDisplay();
}

/* -------------------------------------------------------------
   3. メモ消去処理
------------------------------------------------------------- */
function purgeMemo() {
    document.getElementById('memo-input').value = '';
}

window.onload = () => {
    setTimer(3);
};