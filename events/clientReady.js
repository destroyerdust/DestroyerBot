module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`Client Ready! Logged in as ${client.user.tag}`)
    client.startTime = Date.now()
  },
}
