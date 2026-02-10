const logBox = document.getElementById('log-box');
const countdownEl = document.getElementById('countdown');

const appendLog = (line) => {
  const row = document.createElement('div');
  row.textContent = line;
  logBox.appendChild(row);
  logBox.scrollTop = logBox.scrollHeight;
};

document.getElementById('open-listener').onclick = () => window.mainApi.openListenerWindow();
document.getElementById('pause').onclick = () => window.mainApi.setPaused(true);
document.getElementById('resume').onclick = () => window.mainApi.setPaused(false);
document.getElementById('devtools').onclick = () => window.mainApi.toggleDevtools();

document.getElementById('auto-launch').onchange = (event) => {
  window.mainApi.toggleAutoLaunch(event.target.checked);
};

window.mainApi.onCountdown(({ remaining, paused }) => {
  countdownEl.textContent = paused ? `已暂停（剩余 ${remaining}s）` : `自动启动倒计时 ${remaining}s`;
});

window.mainApi.onLog((line) => appendLog(line));

window.mainApi.getConfig().then((config) => {
  document.getElementById('auto-launch').checked = Boolean(config.settings?.autoStartOnBoot);
});
