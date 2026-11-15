// Whether the guided tour was offered already (this browser), and the desktop app link it shows.
export const DESKTOP_URL = 'https://github.com/LuSo999/LuSo-s-Char-Tracker/releases'
const TOUR_SEEN = 'tourSeen'

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN, '1')
  } catch {
    // no storage: the offer shows again next time
  }
}
export function tourSeen() {
  try {
    return localStorage.getItem(TOUR_SEEN) === '1'
  } catch {
    return false
  }
}
