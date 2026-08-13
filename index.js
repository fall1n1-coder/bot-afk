// Патч 26.2 ОБЯЗАТЕЛЬНО запускается в отдельном процессе и ДО require('mineflayer'),
// иначе minecraft-data закэширует protocolVersions.json без исправлений.
require('child_process').execFileSync(
  process.execPath,
  [require('path').join(__dirname, 'scripts', 'patch-26.2.js')],
  { stdio: 'inherit' }
);

const mineflayer = require('mineflayer');
const express = require('express');

// ==================== НАСТРОЙКИ ====================
// Всё берётся из переменных окружения Render (Environment -> Environment Variables),
// чтобы не хранить данные сервера прямо в коде.

const HOST = process.env.MC_HOST || 'Czyninski.aternos.me';
const PORT = parseInt(process.env.MC_PORT || '25565', 10);
const USERNAME = process.env.MC_USERNAME || 'AFK_Bot';
const VERSION = process.env.MC_VERSION || '26.2'; // требует scripts/patch-26.2.js (см. postinstall) по пингу (работает и для 26.2 после патча)
const RECONNECT_DELAY_MS = parseInt(process.env.RECONNECT_DELAY_MS || '15000', 10);

// Интервалы anti-afk действий (мс)
const JUMP_INTERVAL_MS = 30_000;
const LOOK_INTERVAL_MS = 7_000;
const MOVE_INTERVAL_MS = 45_000;

let bot = null;
let reconnectTimer = null;
let intervals = [];

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function clearBotIntervals() {
  intervals.forEach(clearInterval);
  intervals = [];
}

function createBot() {
  log(`Подключаюсь к ${HOST}:${PORT} как ${USERNAME}${VERSION ? ` (версия: ${VERSION})` : ''}...`);

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: VERSION,
    auth: 'offline', // Aternos обычно работает в offline-режиме
  });

  bot.on('spawn', () => {
    log('Бот заспавнился на сервере.');
    startAntiAfk();
  });

  bot.on('kicked', (reason) => {
    log('Бот кикнут с сервера:', reason);
  });

  bot.on('error', (err) => {
    log('Ошибка соединения:', err && err.message ? err.message : err);
  });

  bot.on('end', (reason) => {
    log('Соединение закрыто:', reason);
    clearBotIntervals();
    scheduleReconnect();
  });

  bot.on('death', () => {
    log('Бот погиб, респавн...');
    bot.respawn();
  });

  bot.on('messagestr', (message) => {
    // Раскомментируй, если хочешь видеть весь чат сервера в логах Render
    // log('CHAT:', message);
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  log(`Переподключение через ${RECONNECT_DELAY_MS / 1000} сек...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, RECONNECT_DELAY_MS);
}

function startAntiAfk() {
  clearBotIntervals();

  // Прыжки
  intervals.push(
    setInterval(() => {
      if (!bot || !bot.entity) return;
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 300);
    }, JUMP_INTERVAL_MS)
  );

  // Вращение камеры (сбивает детекторы AFK, которые следят за неподвижностью взгляда)
  intervals.push(
    setInterval(() => {
      if (!bot || !bot.entity) return;
      const yaw = Math.random() * Math.PI * 2 - Math.PI;
      const pitch = (Math.random() * 0.6 - 0.3);
      bot.look(yaw, pitch, true).catch(() => {});
    }, LOOK_INTERVAL_MS)
  );

  // Небольшое перемещение вперёд-назад
  intervals.push(
    setInterval(() => {
      if (!bot || !bot.entity) return;
      const dir = Math.random() > 0.5 ? 'forward' : 'back';
      bot.setControlState(dir, true);
      setTimeout(() => bot.setControlState(dir, false), 700);
    }, MOVE_INTERVAL_MS)
  );

  // Взмах рукой — многие анти-афк детекторы смотрят и на это
  intervals.push(
    setInterval(() => {
      if (!bot || !bot.entity) return;
      bot.swingArm();
    }, 20_000)
  );

  log('Anti-afk активности запущены.');
}

createBot();

// ==================== KEEP-ALIVE HTTP СЕРВЕР ДЛЯ RENDER ====================
// Render Web Service требует, чтобы приложение слушало $PORT — иначе деплой
// считается упавшим. На бесплатном тарифе Render также "усыпляет" веб-сервисы
// после ~15 минут без HTTP-запросов, поэтому для настоящего 24/7 либо нужен
// платный план, либо внешний пинг (например, UptimeRobot) на этот адрес
// каждые 5-10 минут.

const app = express();
const HTTP_PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    botConnected: !!(bot && bot.entity),
    target: `${HOST}:${PORT}`,
    time: new Date().toISOString(),
  });
});

app.listen(HTTP_PORT, () => {
  log(`Keep-alive сервер слушает порт ${HTTP_PORT}`);
});
