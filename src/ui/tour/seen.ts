// Whether the guided tour was offered already (this browser).
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
