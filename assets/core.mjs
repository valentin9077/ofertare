export const aquaFirmVersion = '0.1.0';
export function readState(){ return JSON.parse(window.localStorage.getItem('aquafirm.core') || '{}'); }
export function writeState(data){ window.localStorage.setItem('aquafirm.core', JSON.stringify(data)); }
