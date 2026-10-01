import {GAME_UUID} from '../game-id';
/** Pages distributes the same frontend; the playable world lives on its UUID host. */
export function Mirror(){
 const zh=navigator.language.toLowerCase().startsWith('zh');
 return <main className="harbor-entry harbor-mirror">
  <img className="harbor-entry__art" src="./poster.png" alt=""/>
  <small>A SUMMER IN HARBOR</small>
  <h1>{zh?'海湾新生活':'A Summer in Harbor'}</h1>
  <p>{zh?'在海湾安顿下来，结识邻居，找到通往海边的路。':'Settle into the bay, meet your neighbours, and find your way to the sea.'}</p>
  <a className="harbor-primary harbor-mirror__play" href={'https://game.aiwaves.tech/'+GAME_UUID+'/'}>{zh?'进入海湾':'Visit the bay'}</a>
  <p>{zh?'在游戏主站继续你的旅程。':'Continue your journey on the game’s home site.'}</p>
 </main>;
}
