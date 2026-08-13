'use strict';

/**
 * patch-26.2.js
 *
 * ПРОВЕРЕНО ВРУЧНУЮ на mineflayer 4.37.1 + minecraft-data 3.113.1.
 *
 * Факты (не предположения):
 * 1. minecraft-data УЖЕ содержит корректную запись для "26.2"
 *    (pc/common/protocolVersions.json): protocol version 776, dataVersion 4903,
 *    majorVersion "26.1" — то есть блоки/предметы/протокол берутся из уже
 *    существующей папки данных "26.1". mcData('26.2') резолвится без ошибок
 *    "из коробки", патчить minecraft-data не нужно.
 *
 * 2. Реальная причина отказа — отдельная, жёстко зашитая проверка версий
 *    внутри самого mineflayer, в файле lib/version.js:
 *      const testedVersions = [..., '1.21.11']
 *    Если версия сервера "новее" latestSupportedVersion ('1.21.11') и её
 *    протокол не совпадает с протоколом 1.21.11 — mineflayer выбрасывает
 *    Error: "Server version '26.1' is not supported. Latest supported
 *    version is '1.21.11'." — именно это и происходит с 26.1/26.2.
 *
 * Патч: дописываем '26.1' в конец testedVersions в установленном пакете
 * mineflayer. Так как "26.2" использует данные мажора "26.1" (см. пункт 1),
 * этого достаточно — bot.registry для "26.2" резолвится в версию '26.1',
 * которая после патча считается поддерживаемой.
 *
 * Ограничение: новые блоки/предметы, добавленные непосредственно в 26.2
 * (например Cinnabar Block Set), в данных отсутствуют, так как минимальная
 * единица данных здесь — версия 26.1. Для anti-afk бота (ходьба, прыжки,
 * осмотр, чат, реконнект) это не критично.
 *
 * Патч идемпотентен: повторный запуск (например, на каждом деплое Render)
 * ничего не портит и не дублирует записи.
 */

const fs = require('fs');

const VERSION_TO_ADD = '26.1';

function log(...args) {
  console.log('[patch-26.2]', ...args);
}

function main() {
  let versionFilePath;
  try {
    versionFilePath = require.resolve('mineflayer/lib/version.js');
  } catch (err) {
    log('mineflayer не найден в node_modules — пропускаю (npm install ещё не выполнен?).');
    return;
  }

  const content = fs.readFileSync(versionFilePath, 'utf8');

  if (content.includes(`'${VERSION_TO_ADD}'`)) {
    log(`Версия ${VERSION_TO_ADD} уже присутствует в testedVersions — патч не требуется.`);
    return;
  }

  const match = content.match(/const testedVersions = \[([^\]]*)\]/);
  if (!match) {
    log('Не удалось найти testedVersions в lib/version.js — формат файла изменился, патч пропущен.');
    log('Проверь вручную поддержку 26.x в установленной версии mineflayer.');
    return;
  }

  const patched = content.replace(
    /const testedVersions = \[([^\]]*)\]/,
    (full, inner) => `const testedVersions = [${inner.trimEnd()}, '${VERSION_TO_ADD}']`
  );

  fs.writeFileSync(versionFilePath, patched);
  log(`Готово: '${VERSION_TO_ADD}' добавлена в testedVersions mineflayer. Версии 26.1/26.2 теперь принимаются.`);
}

main();
