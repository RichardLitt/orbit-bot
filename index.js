/*
  A simple Orbit bot that listens on a channel and caches all messages.

  Usage:
  node index.js <botname> <channel> [<interval> <text>]

  Eg.
  node index.js Cacher1 ipfs
*/

'use strict'

const IpfsDaemon = require('ipfs-daemon/src/ipfs-node-daemon')
const Orbit = require('orbit_')

// Options
let user = process.argv[2] || 'orbit-bot'
let channel = process.argv[3] || 'skynet'
let interval = process.argv[4] || 1000
let text = process.argv[5] || 'ping'

// State
let orbit

// MAIN
const dataDir = './orbit-bot-data/' + user
const ipfsDataDir = dataDir + '/ipfs'

function formatTimestamp(timestamp) {
  const safeTime = (time) => ("0" + time).slice(-2)
  const date = new Date(timestamp)
  return safeTime(date.getHours()) + ":" + safeTime(date.getMinutes()) + ":" + safeTime(date.getSeconds())
}

// Start an IPFS daemon
const ipfs = new IpfsDaemon({ 
  IpfsDataDir: ipfsDataDir,
  SignalServer: 'star-signal.cloud.ipfs.team', // IPFS dev server
  Addresses: {
    API: '/ip4/127.0.0.1/tcp/0',
    Swarm: [
      '/ip4/0.0.0.0/tcp/0'
    ],
    Gateway: '/ip4/0.0.0.0/tcp/0'
  },
  Discovery: {
    MDNS: {
      Enabled: false,
      Interval: 10
    },
    webRTCStar: {
      Enabled: true
    }
  },
})

ipfs.on('ready', () => {
  // Output the IPFS id
  ipfs.id()
    .then((id) => {
      console.log("Peer ID:")
      console.log(">", id.id)
      console.log("Addresses:")
      id.addresses.forEach((e) => console.log(">", e))
      console.log("Public Key:")
      console.log(">", id.publicKey)
    })

  // Setup Orbit
  const options = {
    cachePath: dataDir + '/orbit-db',
    maxHistory: 10,
    keystorePath: dataDir + '/keystore'
  }

  orbit = new Orbit(ipfs, options)

  orbit.connect(user)
    .then(() => {
      console.log(`-!- Connected to ${orbit.network.name}`)
      return orbit.join(channel)
    })
    .then(() => {
      console.log(`-!- Joined #${channel}`)    
      let pingCount = 1

      const feed = orbit.channels[channel].feed

      // Handle new messages
      orbit.events.on('message', (channel, post) => {
        console.log(`${formatTimestamp(post.meta.ts)} < ${post.meta.from.name}> ${post.content}`)
      })

      feed.events.on('synced', (channel) => {
        orbit.get(channel, null, null, 10)
          .then((messages) => {
            messages.forEach(message => {
              console.log(`${formatTimestamp(message.Post.meta.ts)} < ${message.Post.meta.from.name}> ${message.Post.content}`)
            })
          })
          .catch((e) => console.error(e))
      })

      // Send message at intervals
      setInterval(() => {
        orbit.send(channel, `${text} #${pingCount++}`)
      }, interval)

      return
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })

})

ipfs.on('error', (e) => console.error(e))
