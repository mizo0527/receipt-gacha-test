const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusText = document.getElementById("statusText");
const resultPanel = document.getElementById("resultPanel");
const resultText = document.getElementById("resultText");

let scannerRunning = false;
let lastCandidate = "";
let sameCandidateCount = 0;

startButton.addEventListener("click", startScanner);
stopButton.addEventListener("click", stopScanner);

function startScanner() {
  if (scannerRunning) return;

  if (typeof Quagga === "undefined") {
    statusText.textContent =
      "バーコード読取ライブラリを読み込めませんでした。";
    return;
  }

  resultPanel.classList.add("hidden");
  resultText.textContent = "";

  lastCandidate = "";
  sameCandidateCount = 0;

  startButton.disabled = true;
  statusText.textContent = "カメラを起動しています…";

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

        /*
          画面中央の広い範囲を解析。
          バーコードが縦向き・横向きでも拾いやすくする。
        */
        area: {
          top: "18%",
          right: "2%",
          left: "2%",
          bottom: "18%"
        }
      },

      locator: {
        /*
          細い線の長いバーコードを優先。
          halfSample:falseで解像度を落とさない。
        */
        patchSize: "large",
        halfSample: false
      },

      numOfWorkers: Math.max(
        1,
        Math.min(4, navigator.hardwareConcurrency || 2)
      ),

      frequency: 15,

      /*
        今回はレシートのCODE128だけに集中。
        読取方式を増やしすぎると遅くなり、
        誤読候補も増える。
      */
      decoder: {
        readers: [
          "code_128_reader"
        ],

        multiple: false
      },

      locate: true
    },

    function onInit(error) {
      if (error) {
        console.error("Quagga初期化エラー:", error);

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
        "バーコード全体と左右の白い余白を、中央の枠へ入れてください";
    }
  );
}

function stopScanner() {
  if (!scannerRunning) return;

  try {
    Quagga.stop();
  } catch (error) {
    console.warn("停止時の警告:", error);
  }

  scannerRunning = false;

  stopButton.classList.add("hidden");
  startButton.classList.remove("hidden");

  startButton.disabled = false;
  startButton.textContent = "もう一度読む";

  statusText.textContent =
    "停止しました。「もう一度読む」を押してください";
}

/*
  バーコード候補を検出したときに呼ばれる。
*/
Quagga.onDetected(function onDetected(data) {
  const code = data?.codeResult?.code;

  if (!code) return;

  console.log("読取候補:", code);

  /*
    同じ文字列が2回続いたら確定。
    前版の品質判定は一旦外す。
  */
  if (code === lastCandidate) {
    sameCandidateCount += 1;
  } else {
    lastCandidate = code;
    sameCandidateCount = 1;

    statusText.textContent =
      "候補を検出しました：" + code + "　確認中…";
  }

  if (sameCandidateCount < 2) return;

  /*
    ライフのレシート想定形式：
    A + 数字16桁 + A

    ただし検証中は形式が違っても結果を表示する。
  */
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

  statusText.textContent = "読み取り成功！";

  if (navigator.vibrate) {
    navigator.vibrate(140);
  }

  stopButton.classList.add("hidden");
  startButton.classList.remove("hidden");

  startButton.disabled = false;
  startButton.textContent = "別のレシートを読む";

  console.log("確定結果:", code);
}
