const buttons = document.querySelectorAll("nav button");
const content = document.getElementById("content");
const home = document.getElementById("home");
const frames = {};

buttons.forEach(button => {
  button.onclick = () => {
    const src = button.dataset.src;

    // 選択したボタンを強調する
    buttons.forEach(otherButton => {
      otherButton.classList.toggle("active", otherButton === button);
    });

    // 初めて開く画面なら、作成して保存する
    if (src && !frames[src]) {
      const iframe = document.createElement("iframe");
      iframe.src = src;
      frames[src] = iframe;
      content.append(iframe);
    }

    // Homeと各画面の表示を切り替える
    home.hidden = Boolean(src);

    for (const frameSrc in frames) {
      frames[frameSrc].hidden = frameSrc !== src;
    }
  };
});

// 最初はHomeを表示する
buttons[0].click();