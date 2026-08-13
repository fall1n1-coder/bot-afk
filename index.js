const mineflayer = require('mineflayer')

const HOST = process.env.MC_HOST || 'Czyninski.aternos.me'
const PORT = Number(process.env.MC_PORT || 25565)
const USERNAME = process.env.MC_USERNAME || 'AFK_Bot'

function startBot() {
  console.log(
    `[${new Date().toISOString()}] Подключаюсь к ${HOST}:${PORT} как ${USERNAME} (версия: 26.2)...`
  )

  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: '26.2',
    auth: 'offline'
  })

  bot.once('spawn', () => {
    console.log('=================================')
    console.log('Бот успешно вошёл на сервер!')
    console.log(`Ник: ${USERNAME}`)
    console.log(`Сервер: ${HOST}:${PORT}`)
    console.log('=================================')

    // Небольшое движение, чтобы бот не был полностью неподвижным
    setInterval(() => {
      if (!bot.entity) return

      bot.look(
        bot.entity.yaw + 0.5,
        bot.entity.pitch,
        false
      )
    }, 30000)
  })

  bot.on('kicked', reason => {
    console.log('Бот был кикнут:', reason)
  })

  bot.on('error', error => {
    console.log('Ошибка:', error.message)
  })

  bot.on('end', () => {
    console.log('Соединение закрыто.')
    console.log('Переподключение через 10 секунд...')

    setTimeout(() => {
      startBot()
    }, 10000)
  })
}

startBot()
