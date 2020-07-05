const conn = {
  sock: null,
  gameState: null,
  config() {
    const udp = require('dgram')
    this.sock = udp.createSocket('udp4')
    this.sock.on('message', this.onMsg.bind(this))
    setInterval(() => this.send({ heartbeat: true }), 1000)
  },
  onMsg(raw, sender) {
    //console.log('onMsg', sender, raw)
    const data = JSON.parse(raw.toString())
    if (data.setState)
      this.gameState = data.state
  },
  send(obj) {
    //console.log('send', obj)
    this.sock.send(
      Buffer.from(JSON.stringify(obj)),
      8000,
      'localhost',
    )
  },
}

const ui = {
  config() {
    setInterval(this.render.bind(this), 100)
  },
  render() {
    if (!conn.gameState) return
    const {
      user,
      otherUsers,
      cookies,
    } = conn.gameState
    const allUsers = [user, ...otherUsers || []]
    if (!user || !otherUsers) return
    const mapSize = 10
    const map = new Array(mapSize).fill([]).map(x => new Array(mapSize).fill(' '))
    cookies
      .filter(x => x[0] < mapSize && x[1] < mapSize)
      .forEach(x => map[x[0]][x[1]] = '•')
    //  .forEach(x => map[x.geo[0]][x.geo[1]] = '○')
    map[user.head[0]][user.head[1]] = '⬤'
    user.tail
      .filter(x => x[0] >= 0 && x[1] >= 0)
      .forEach(x => map[x[0]][x[1]] = '⬤')

    otherUsers
      .forEach(user => {
        map[user.head[0]][user.head[1]] = '○'
        user.tail
          .filter(x => x[0] >= 0 && x[1] >= 0)
          .forEach(x => map[x[0]][x[1]] = '○')
      })

    console.clear()
    console.table(map, map.map((_, idx) => idx))
    console.log('\n'.repeat(3))
    console.log('You:', user.id)
    console.log('Scores:')
    console.table(allUsers
      .filter(u => u.createMs)
      .sort((a, b) => a.createMs > b.createMs)
      .map(x => ({
        id: x.id,
        score: x.tail.length || 0,
        'live(sec)': Math.round((Date.now() - x.createMs) / 1000)
      }))
    )
  },
}

const input = {
  onKeyPress(name) {
    const gameState = conn.gameState
    if (!gameState) return
    const user = gameState.user
    const keyDirectionMap = { up: 1, right: 2, down: 3, left: 4 }
    const newDirection = keyDirectionMap[name]
    if (!newDirection) return
    if (
      user.direction !== 0 &&
      (user.direction + newDirection) % 2 === 0
    ) return
    user.direction = newDirection
    conn.send({ direction: newDirection })
  },
  config() {
    const readline = require('readline');
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (_, key) => {
      if (key.ctrl && key.name === 'c')
        process.exit()
      else
        this.onKeyPress(key.name)
    });
  }
}

conn.config()
ui.config()
input.config()

