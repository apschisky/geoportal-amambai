const geoportalState = {
  userLonLat: null,
  ultimoPopupHtml: '',
  activePopupSource: null,
  nextPopupSource: null,
  activePopupRefreshCoord: null,
  nextPopupRefreshCoord: null,
  measureActive: false
};

export function getGeoportalState() {
  return geoportalState;
}

export function getGeoportalStateValue(key) {
  return geoportalState[key];
}

export function setGeoportalStateValue(key, value) {
  geoportalState[key] = value;
  return value;
}

export function clearGeoportalStateValue(key) {
  geoportalState[key] = null;
}

export function getActivePopupSource() {
  return geoportalState.activePopupSource;
}

export function setActivePopupSource(value) {
  geoportalState.activePopupSource = value;
  return value;
}

export function clearActivePopupSource() {
  geoportalState.activePopupSource = null;
}

export function getNextPopupSource() {
  return geoportalState.nextPopupSource;
}

export function setNextPopupSource(value) {
  geoportalState.nextPopupSource = value;
  return value;
}

export function clearNextPopupSource() {
  geoportalState.nextPopupSource = null;
}

export function getActivePopupRefreshCoord() {
  return geoportalState.activePopupRefreshCoord;
}

export function setActivePopupRefreshCoord(value) {
  geoportalState.activePopupRefreshCoord = value;
  return value;
}

export function clearActivePopupRefreshCoord() {
  geoportalState.activePopupRefreshCoord = null;
}

export function getNextPopupRefreshCoord() {
  return geoportalState.nextPopupRefreshCoord;
}

export function setNextPopupRefreshCoord(value) {
  geoportalState.nextPopupRefreshCoord = value;
  return value;
}

export function clearNextPopupRefreshCoord() {
  geoportalState.nextPopupRefreshCoord = null;
}
