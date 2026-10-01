export const GAME_UUID = "e78df027-7ef4-4d49-82eb-ea91f03d9fb3";
export const getGameUuid=()=>{const path=typeof location!=="undefined"?location.pathname.split("/")[1]:"";return /^[0-9a-f-]{36}$/i.test(path)?path:GAME_UUID};
export const getGameApiBase=()=>"/"+getGameUuid();
