import type {Save} from '../story/state';
import type {Words} from '../world/data';
import {weatherForSave} from './state';
const rainReactions:Record<string,Words>={
 mara:['她把工具袋的口拢紧，先停下沿街的小步子。“等雨轻一点再看窗台吧。”','She closes the tool bag and pauses her stroll. “The windowsills can wait until the rain eases.”'],
 elena:['她抬手接了一点雨，暂时收起水壶。“这一点雨帮得上忙，不过不用替每一株都作保证。”','She feels a few drops and sets her watering can aside. “A little help, though I won’t promise it is enough for every plant.”'],
 arthur:['他把记录本护在帽檐下。“眼下是小雨。下一阵怎样，还得再看。”','He protects his notebook beneath his hat. “Light rain now. What comes next still needs watching.”'],
 dani:['她合上夹着叶子的本子，把纸页挡在雨滴之外。“故事可以慢慢记，先别让这一页湿了。”','She closes the leaf-filled notebook against the drops. “The story can wait. First, keep this page dry.”'],
 owen:['他暂停沿路走动，听雨滴与远处鸟声之间的空隙。“这会儿更得慢慢听。”','He stops walking to listen between the drops and distant bird calls. “This takes a little more patience now.”'],
 avery:['对方合起速写本，把没画完的那页护好。“雨后的光也值得回来看看。”','They close the sketchbook and protect the unfinished page. “The light after rain is worth coming back for.”'],
};
type WeatherResidentSave=Pick<Save,'townMinutes'|'weatherV1'|'weatherEcologyV1'>;
export function residentRainPause(s:WeatherResidentSave,person:string|undefined,outdoor:boolean){return !!person&&!!rainReactions[person]&&!!s.weatherEcologyV1&&outdoor&&weatherForSave(s)==='light-rain'}
export function residentWeatherReaction(s:WeatherResidentSave&Pick<Save,'known'>,person:string,outdoor:boolean):Words|undefined{return s.known.includes(person)&&residentRainPause(s,person,outdoor)?rainReactions[person]:undefined}
