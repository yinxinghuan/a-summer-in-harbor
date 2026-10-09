import type {WeatherState} from './state';
/** An optional, current-minute policy pin; never created by a GET or UI clock. */
export type WeatherEcologyState={schema:1;ruleset:'harbor-weather-ecology-v1';activatedAt:number;settledThrough:number;rainDay:number;mintRainUsed:number};
export const mintRainCap=60;
export function createWeatherEcology(minute:number):WeatherEcologyState{
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('INVALID_WEATHER_ECOLOGY_INPUT');
 return {schema:1,ruleset:'harbor-weather-ecology-v1',activatedAt:minute,settledThrough:minute,rainDay:Math.floor(minute/1440),mintRainUsed:0};
}
export function validWeatherEcology(v:unknown,minute:number,weather?:WeatherState):v is WeatherEcologyState{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const s=v as WeatherEcologyState;
 return Object.keys(s).sort().join(',')==='activatedAt,mintRainUsed,rainDay,ruleset,schema,settledThrough'&&s.schema===1&&s.ruleset==='harbor-weather-ecology-v1'&&Number.isSafeInteger(s.activatedAt)&&s.activatedAt>=0&&s.activatedAt<=minute&&s.settledThrough===minute&&s.rainDay===Math.floor(minute/1440)&&Number.isSafeInteger(s.mintRainUsed)&&s.mintRainUsed>=0&&s.mintRainUsed<=mintRainCap&&!!weather&&s.activatedAt>=weather.activatedAt;
}
