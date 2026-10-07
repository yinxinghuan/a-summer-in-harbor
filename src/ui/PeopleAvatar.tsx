import crops from './people-avatar-crops.json';
import './people-avatar.css';

/** Individually reviewed upright head/shoulder/chest windows in unchanged 256px sources.
 * The map sheets and enlarged portraits keep their existing consumers. */
export function PeopleAvatar({person,alt=''}:{person:string;alt?:string}){
 const [x,y,width,height]=(crops as Record<string,number[]>)[person];
 return <span className="harbor-person-avatar" data-person={person}>
  <img src={`./art/people-avatars/${person}.png`} alt={alt} draggable={false}
   style={{width:`${256/width*100}%`,height:`${256/height*100}%`,left:`${-x/width*100}%`,top:`${-y/height*100}%`}}/>
 </span>;
}
