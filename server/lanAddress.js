import { networkInterfaces } from 'node:os'

// The address other machines on the network can reach this one at. Used by
// both servers' banners so the URL a guest is told to open is the one that
// actually works from another computer - "localhost" is the single most
// common reason a LAN game fails to connect.
export function getLanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}
