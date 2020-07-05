const udp = require('dgram')

const sock = udp.createSocket('udp4')

const gameState = {
  users: [],
  cookies: [
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 2],
  ]
}

function identifyClient(client) {
  return client.address + ':' + client.port
}

function onHeartbeat(sender) {
  const id = identifyClient(sender)
  const isUserExist = !!gameState.users.find(x => x.id === id)
  if (!isUserExist)
    gameState.users.push({
      id,
      heartbeat: Date.now(),
      client: sender,
      createMs: Date.now(),
      head: [4, 4],
      tail: [[-10,-10],[-10,-10],[-10,-10]],
      // 0(nowhere), 1(up), 2(right), 3(down), 4(left)
      direction: 2, 
    })
  const userIndex = gameState.users.findIndex(x => x.id === id)
  const user = gameState.users[userIndex]
  user.heartbeat = Math.max(user.heartbeat, Date.now())
}

function onPing(sender) {
  send({ pong: true }, sender)
}

function removeOldUsers() {
  const maxNoHeartbeatMs = 10 * 1000
  const usersToRemove = gameState.users
    .filter(x => Date.now() - x.heartbeat > maxNoHeartbeatMs)
  gameState.users = gameState.users
    .filter(x => !usersToRemove.includes(x))
}

function onDirectionChange(sender, direction) {
  const id = identifyClient(sender)
  const user = gameState.users.find(x => x.id === id)
  if (!user) return
  if (
    direction < 1 &&
    direction > 4 &&
    user.direction !== 0 &&
    (user.direction + direction) % 2 === 0
  ) return
  user.direction = direction
}

function onMsg(raw, sender) {
  const data = JSON.parse(raw.toString())
  console.log('onMsg', sender, data)
  if (data.heartbeat) onHeartbeat(sender)
  if (data.direction) onDirectionChange(sender, data.direction)
}

function send(obj, receiver) {
  console.log('send', receiver, obj)
  return sock.send(
    Buffer.from(JSON.stringify(obj)),
    receiver.port,
    receiver.address,
  )
}

function getUserState(id) {
  const user = gameState.users.find(x => x.id === id)
  const otherUsers = gameState.users.filter(x => x !== user)
  const cookies = gameState.cookies
  if (!user) throw new Error('user does not exist')
  return {
    user,
    otherUsers,
    cookies,
  }
}

function syncAllUsers() {
  const users = gameState.users
  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const state = { setState: true, state: getUserState(user.id) }
    send(state, user.client)
  }
}

function updateCookies() {
  gameState.cookies = new Array(100)
    .fill({})
    .map(_ => [
      Math.floor(Math.random() * 50),
      Math.floor(Math.random() * 50),
    ])
}

function calculateNextStep() {
  const users = gameState.users
  const cookies = gameState.cookies
  // calculate next heads/tail positions
  users.forEach(user => {
    const oldHead = [...user.head]
    const tailSize = user.tail.length
    if (user.direction === 1) user.head[0] -= 1
    if (user.direction === 2) user.head[1] += 1
    if (user.direction === 3) user.head[0] += 1
    if (user.direction === 4) user.head[1] -= 1
    user.tail = [oldHead, ...user.tail].slice(0, tailSize)
  })

  const positionsThatHeadShouldNotBeOn = users
    .map(x => x.tail.map(y => [...y]))
    .reduce((a, c) => [...a, ...c], [])
  // respown user on game over
  users.forEach(user => {
    if (
      user.head[0] < 0 || user.head[0] > 9 ||
      user.head[1] < 0 || user.head[1] > 9 ||
      positionsThatHeadShouldNotBeOn.find(x => x.join() === user.head.join())
    ) {
      user.head = [4, 4]
      user.tail = new Array(user.tail.length).fill({}).map(_ => [...user.head])
    }
  })
}

sock.on('message', onMsg)
sock.bind(8000)

setInterval(removeOldUsers, 1000)
setInterval(calculateNextStep, 500)
setInterval(updateCookies, 10 * 1000)
setInterval(syncAllUsers, 100)
