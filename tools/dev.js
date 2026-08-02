// Runs both halves of the game in one process: the WebSocket match server
// and the no-cache static server for the client. Two terminals were only
// ever an artefact of the client being served by a separate tool - there is
// no reason for the player to manage two commands.
//
// Both modules start listening on import; they use different ports and share
// nothing, so importing them together is the whole implementation.
import './serve.js'
import '../server/index.js'

// Both modules log their own line as they bind. This runs after those
// callbacks have had a turn, so the instruction the player actually needs
// ends up last rather than buried.
setTimeout(() => {
  const webPort = process.env.WEB_PORT || 8843
  console.log('')
  console.log(`Para jogar: abra http://localhost:${webPort} no navegador.`)
  console.log('Sozinho já funciona - as vagas restantes viram bots.')
}, 50)
