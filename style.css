* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f5f5f5;
  color: #222;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue",
    "Yu Gothic", "Meiryo", sans-serif;
}

.app {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: 28px 16px 48px;
  text-align: center;
}

h1 {
  margin: 0 0 12px;
  font-size: 25px;
}

.guide {
  margin: 0 0 18px;
  color: #555;
  font-size: 16px;
  line-height: 1.6;
}

button {
  min-width: 220px;
  padding: 14px 24px;
  border: 0;
  border-radius: 12px;
  background: #168b3f;
  color: white;
  font-size: 18px;
  font-weight: 700;
}

button:disabled {
  opacity: 0.55;
}

.scanner-wrap {
  position: relative;
  width: 100%;
  margin: 22px auto 14px;
  overflow: hidden;
  border-radius: 16px;
  background: #111;
}

#reader {
  width: 100%;
  min-height: 280px;
  background: #111;
}

#reader video {
  width: 100% !important;
  height: auto !important;
  object-fit: cover;
}

.scan-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.14);
}

.scan-frame {
  position: relative;
  width: 88%;
  height: 120px;
}

.corner {
  position: absolute;
  width: 34px;
  height: 34px;
  border-color: white;
  border-style: solid;
}

.top-left {
  top: 0;
  left: 0;
  border-width: 4px 0 0 4px;
  border-radius: 12px 0 0 0;
}

.top-right {
  top: 0;
  right: 0;
  border-width: 4px 4px 0 0;
  border-radius: 0 12px 0 0;
}

.bottom-left {
  bottom: 0;
  left: 0;
  border-width: 0 0 4px 4px;
  border-radius: 0 0 0 12px;
}

.bottom-right {
  right: 0;
  bottom: 0;
  border-width: 0 4px 4px 0;
  border-radius: 0 0 12px 0;
}

.scan-line {
  position: absolute;
  top: 50%;
  left: 5%;
  width: 90%;
  height: 2px;
  background: #38e56b;
  box-shadow: 0 0 8px #38e56b;
  animation: scan 1.8s ease-in-out infinite;
}

@keyframes scan {
  0% {
    transform: translateY(-42px);
  }

  50% {
    transform: translateY(42px);
  }

  100% {
    transform: translateY(-42px);
  }
}

.status {
  min-height: 24px;
  margin: 10px 0;
  font-weight: 700;
}

.result {
  margin-top: 16px;
  padding: 18px;
  border-radius: 14px;
  background: white;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
  word-break: break-all;
}

.result-title {
  margin-bottom: 8px;
  color: #168b3f;
  font-weight: 800;
}

#resultText {
  font-family: monospace;
  font-size: 18px;
}

.hidden {
  display: none;
}
