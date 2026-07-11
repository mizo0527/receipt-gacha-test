const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusText = document.getElementById("statusText");
const resultPanel = document.getElementById("resultPanel");
const resultText = document.getElementById("resultText");

let scannerRunning = false;
let lastCandidate = "";
let sameCandidateCount = 0;

let barcodeSeen = false;
let lastBarcodeSeenAt = 0;
let processingTimer = null;

startButton.addEventListener("click", startScanner);
stopButton.addEventListener("click", stopScanner);

function setStatus(message) {
  statusText.textContent = message;
  console.log("[状態]", message);
}

function startScanner() {
  if (scannerRunning) return;

  if (typeof Quagga === "undefined") {
    setStatus("読取ライブラリを読み込めませんでした");
    return;
  }

  resultPanel.classList.add("hidden");
  resultText.textContent = "";

  lastCandidate = "";
  sameCandidateCount = 0;
  barcodeSeen = false;
  lastBarcodeSeenAt = 0;

  startButton.disabled = true;
  setStatus("① カメラを起動しています…");

  Quagga.init(
    {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: document.querySelector("#cameraArea"),

        constraints: {
          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 1920
          },

          height: {
            ideal: 1080
          }
        },

        area: {
          top: "18%",
          right: "2%",
          left: "2%",
          bottom: "18%"
        }
      },

      locator: {
        patchSize: "large",
        halfSample: false
      },

      numOfWorkers: Math.max(
        1,
        Math.min(4, navigator.hardwareConcurrency || 2)
      ),

      frequency: 15,

    decoder: {
  readers: [
    "codabar_reader"
  ],
  multiple: false
},

      locate: true
    },

    function onInit(error) {
      if (error) {
        console.error("Quagga初期化エラー:", error);

        setStatus(
          "カメラを起動できませんでした。ページを再読み込みしてください"
        );

        startButton.disabled = false;
        return;
      }

      Quagga.start();

      scannerRunning = true;

      startButton.classList.add("hidden");
      stopButton.classList.remove("hidden");

      setStatus("② カメラ起動完了。バーコードを探しています…");
    }
  );
}

/*
  毎フレームの解析状況を見る。
  バーコードらしい領域が見つかった時点で状態を変える。
*/
Quagga.onProcessed(function onProcessed(result) {
  if (!scannerRunning || !result) return;

  const hasBoxes =
    Array.isArray(result.boxes) &&
    result.boxes.length > 0;

  const hasMainBox =
    Array.isArray(result.box) &&
    result.box.length > 0;

  const hasBarcodeShape =
    hasBoxes || hasMainBox;

  if (hasBarcodeShape) {
    lastBarcodeSeenAt = Date.now();

    if (!barcodeSeen) {
      barcodeSeen = true;
      setStatus("③ バーコードを検知しました！");
    }

    if (!result.codeResult?.code) {
      clearTimeout(processingTimer);

      processingTimer = setTimeout(() => {
        if (scannerRunning && barcodeSeen) {
          setStatus(
            "④ バーコード読み取り中…そのまま動かさないでください"
          );
        }
      }, 250);
    }

    return;
  }

  /*
    一瞬見失っただけでは表示を戻さない。
  */
  if (
    barcodeSeen &&
    Date.now() - lastBarcodeSeenAt > 1000
  ) {
    barcodeSeen = false;

    setStatus(
      "② バーコードを探しています。全体と左右の白い余白を枠内へ"
    );
  }
});

/*
  文字列までデコードできた時に呼ばれる。
*/
Quagga.onDetected(function onDetected(data) {
  const code = data?.codeResult?.code;

  if (!code || !scannerRunning) return;

  console.log("読取候補:", code);

  setStatus("⑤ 番号を検出しました。内容を確認中…");

  if (code === lastCandidate) {
    sameCandidateCount += 1;
  } else {
    lastCandidate = code;
    sameCandidateCount = 1;
  }

  /*
    誤読防止のため、同じ結果が2回続いたら確定。
  */
  if (sameCandidateCount < 2) {
    return;
  }

  const isLifeReceipt = /^A\d{16}A$/.test(code);

  finishReading(code, isLifeReceipt);
});

function finishReading(code, isLifeReceipt) {
  if (!scannerRunning) return;

  try {
    Quagga.stop();
  } catch (error) {
    console.warn("停止時の警告:", error);
  }

  scannerRunning = false;

  resultPanel.classList.remove("hidden");

  if (isLifeReceipt) {
    const purchaseDate = code.slice(1, 9);
    const registerNo = code.slice(9, 13);
    const receiptNo = code.slice(13, 17);

    resultText.innerHTML =
      code +
      "<br><br>" +
      "購入日：" + purchaseDate +
      "<br>" +
      "レジ番号：" + registerNo +
      "<br>" +
      "レシートNo：" + receiptNo;
  } else {
    resultText.innerHTML =
      code +
      "<br><br>" +
      "※バーコードは読めましたが、" +
      "想定したレシート形式とは異なります。";
  }

  setStatus("⑥ バーコード読み取り完了！");

  if (navigator.vibrate) {
    navigator.vibrate(140);
  }

  stopButton.classList.add("hidden");
  startButton.classList.remove("hidden");

  startButton.disabled = false;
  startButton.textContent = "別のレシートを読む";

  console.log("確定結果:", code);
}

function stopScanner() {
  if (!scannerRunning) return;

  try {
    Quagga.stop();
  } catch (error) {
    console.warn("停止時の警告:", error);
  }

  scannerRunning = false;

  clearTimeout(processingTimer);

  stopButton.classList.add("hidden");
  startButton.classList.remove("hidden");

  startButton.disabled = false;
  startButton.textContent = "もう一度読む";

  setStatus("停止しました");
}
