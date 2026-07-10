const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusText = document.getElementById("statusText");
const resultPanel = document.getElementById("resultPanel");
const resultText = document.getElementById("resultText");

let scannerRunning = false;
let acceptedCode = "";
let acceptedAt = 0;

startButton.addEventListener("click", startScanner);
stopButton.addEventListener("click", stopScanner);

function startScanner() {
  if (scannerRunning) {
    return;
  }

  if (typeof Quagga === "undefined") {
    statusText.textContent =
      "バーコード読取ライブラリを読み込めませんでした。";
    return;
  }

  resultPanel.classList.add("hidden");
  resultText.textContent = "";
  acceptedCode = "";
  acceptedAt = 0;

  startButton.disabled = true;
  statusText.textContent = "カメラを起動しています…";

  Quagga.init(
    {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: document.querySelector("#cameraArea"),

        constraints: {
          facingMode: "environment",

          width: {
            min: 640,
            ideal: 1920
          },

          height: {
            min: 480,
            ideal: 1080
          },

          aspectRatio: {
            ideal: 1.7777778
          }
        },

        area: {
          top: "34%",
          right: "5%",
          left: "5%",
          bottom: "34%"
        }
      },

      locator: {
        patchSize: "medium",
        halfSample: false
      },

      numOfWorkers: Math.max(
        1,
        Math.min(4, navigator.hardwareConcurrency || 2)
      ),

      frequency: 12,

      decoder: {
        readers: [
          "code_128_reader",
          "code_39_reader",
          "code_93_reader",
          "codabar_reader",
          "ean_reader",
          "ean_8_reader",
          "upc_reader",
          "upc_e_reader",
          "i2of5_reader",
          "2of5_reader"
        ],

        multiple: false
      },

      locate: true
    },

    function onInit(error) {
      if (error) {
        console.error(error);

        statusText.textContent =
          "カメラを起動できませんでした。ページを再読み込みしてください。";

        startButton.disabled = false;
        return;
      }

      Quagga.start();

      scannerRunning = true;
      startButton.classList.add("hidden");
      stopButton.classList.remove("hidden");

      statusText.textContent =
        "バーコードを横向きにして、中央の枠いっぱいへ合わせてください";
    }
  );
}

function stopScanner() {
  if (!scannerRunning) {
    return;
  }

  try {
    Quagga.stop();
  } catch (error) {
    console.warn(error);
  }

  scannerRunning = false;

  stopButton.classList.add("hidden");
  startButton.classList.remove("hidden");
  startButton.disabled = false;
  startButton.textContent = "もう一度読む";

  statusText.textContent =
    "停止しました。「もう一度読む」を押してください";
}

Quagga.onDetected(function onDetected(data) {
  const code = data?.codeResult?.code;
  const errors = data?.codeResult?.decodedCodes
    ?.filter(item => typeof item.error === "number")
    ?.map(item => item.error);

  if (!code || !errors || errors.length === 0) {
    return;
  }

  const averageError =
    errors.reduce((sum, value) => sum + value, 0) / errors.length;

  /*
    誤読防止：
    同じコードが短時間に2回検出されたときだけ確定する。
  */

  const now = Date.now();

  if (
    acceptedCode !== code ||
    now - acceptedAt > 1600
  ) {
    acceptedCode = code;
    acceptedAt = now;

    statusText.textContent =
      "同じバーコードをもう一度確認しています…";

    return;
  }

  /*
    読取品質が極端に悪い候補を除外。
    数値が小さいほど比較的良好。
  */

  if (averageError > 0.35) {
    statusText.textContent =
      "ピントを合わせて、もう少しだけ近づけてください";

    return;
  }

  finishReading(code);
});

function finishReading(code) {
  resultText.textContent = code;
  resultPanel.classList.remove("hidden");

  statusText.textContent = "読み取り成功！";

  if (navigator.vibrate) {
    navigator.vibrate(140);
  }

  try {
    Quagga.stop();
  } catch (error) {
    console.warn(error);
  }

  scannerRunning = false;

  stopButton.classList.add("hidden");
  startButton.classList.remove("hidden");
  startButton.disabled = false;
  startButton.textContent = "別のレシートを読む";

  console.log("読み取り結果:", code);
}
