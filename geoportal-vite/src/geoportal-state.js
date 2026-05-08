const geoportalState = {
  userLonLat: null,
  ultimoPopupHtml: '',
  activePopupSource: null,
  nextPopupSource: null,
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
