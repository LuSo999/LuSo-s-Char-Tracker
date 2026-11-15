// Whether a guided tour was offered already (this browser), by key.
export const TOUR = 'tourSeen'
export const CREATE_TOUR = 'createTourSeen'

export function markTourSeen(key = TOUR) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // no storage: the offer shows again next time
  }
}
export function tourSeen(key = TOUR) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
