// What to say when a port is already taken.
//
// Node's default for this is an unhandled 'error' event: a twenty-line stack
// trace ending in EADDRINUSE. That is a fine message for a developer and a
// terrible one for the person this game is now installed for - someone who
// clicked the menu icon twice, or left it running in another window, and is
// looking at a wall of red asking what they broke.
//
// The cause is almost always the same and the fix is almost always the same,
// so say both.

export function explainPortInUse(error, { port, what }) {
  if (error?.code !== 'EADDRINUSE') return false
  console.error(`\nO AlmondegoUs já está aberto (a porta ${port}, do ${what}, está ocupada).`)
  console.error('Feche a outra janela do jogo e tente de novo.')
  console.error(`Se tiver certeza de que não está, algum outro programa usa a porta ${port}.`)
  return true
}

// Attaches the message to a server and exits cleanly rather than crashing.
// Exit code 1 either way - this is still a failure, just a legible one.
export function handlePortInUse(server, { port, what }) {
  server.on('error', (error) => {
    if (!explainPortInUse(error, { port, what })) throw error
    process.exit(1)
  })
}
