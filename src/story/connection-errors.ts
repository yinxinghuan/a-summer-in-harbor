import type {Words} from '../world/data';
const messages:Record<string,Words>={
 PLAY_WINDOW_CLOSED:['海湾目前暂停开放。你的旅程仍保留着，请稍后回来。','The bay is closed for now. Your journey is saved; please come back later.'],
 PUBLIC_DEPLOYMENT_UNCONFIGURED:['海湾还在准备迎接访客，请稍后再来。','The bay is getting ready for visitors. Please come back later.'],
 SERVICE_UNAVAILABLE:['暂时连不上海湾，请稍后重新连接。','The bay cannot be reached right now. Please reconnect in a moment.'],
 PLAYER_SESSION_REQUIRED:['请重新连接，再继续这段旅程。','Please reconnect to continue your journey.'],
 PENDING_ACTION:['正在确认上一次操作的结果，请重新读取进度。','Your last action is being checked. Please reload your progress.']
};
export function connectionError(code:string){return messages[code]}
