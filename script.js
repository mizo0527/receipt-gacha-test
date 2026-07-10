const scanButton = document.getElementById("scanButton");
const statusText = document.getElementById("statusText");
const resultBox = document.getElementById("resultBox");
const resultText = document.getElementById("resultText");
const scanOverlay = document.getElementById("scanOverlay");

let scanner = null;
let isScanning = false;

scanButton.addEventListener("click", startScanner);

async function startScanner() {
  if (isScanning) {
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    statusText.textContent = "読取ライブラリを読み込めませんでした。";
    return;
  }

  isScanning = true;
  scanButton.disabled = true;
  resultBox.classList.add("hidden");
  scanOverlay.classList.remove("hidden");
  statusText.textContent = "カメラを起動しています…";

  scanner = new Html5Qrcode("reader", {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.QR_CODE
    ],
    verbose: false
  });

  const config = {
    fps: 12,

    qrbox: (viewfinderWidth, viewfinderHeight) => {
      return {
        width: Math.floor(viewfinderWidth * 0.9),
        height: Math.min(
          130,
          Math.floor(viewfinderHeight * 0.34)
        )
      };
    },

    aspectRatio: 1.4,

    videoConstraints: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      focusMode: "continuous"
    }
  };

  try {
    await scanner.start(
      { facingMode: "environment" },
      config,
      handleSuccess,
      () => {
        statusText.textContent =
          "バーコードを横向きに、枠いっぱいへ近づけてください";
      }
    );

    statusText.textContent =
      "バーコードを横向きに、枠いっぱいへ近づけてください";
  } catch (error) {
    console.error(error);

    statusText.textContent =
      "カメラを起動できませんでした。再読み込みしてお試しください。";

    scanOverlay.classList.add("hidden");
    scanButton.disabled = false;
    isScanning = false;
  }
}

async function handleSuccess(decodedText, decodedResult) {
  statusText.textContent = "読み取り成功！";
  resultText.textContent = decodedText;
  resultBox.classList.remove("hidden");
  scanOverlay.classList.add("hidden");

  if (navigator.vibrate) {
    navigator.vibrate(120);
  }

  try {
    if (scanner && scanner.isScanning) {
      await scanner.stop();
    }
  } catch (error) {
    console.warn("停止処理で警告:", error);
  } finally {
    scanButton.disabled = false;
    scanButton.textContent = "もう一度読む";
    isScanning = false;
  }

  console.log("形式:", decodedResult?.result?.format?.formatName);
  console.log("内容:", decodedText);
}
