import {useEffect,useState} from 'react';
import {prepareCropImage} from '../world/crop-art';
export function CropImage({image,alt,transparent=false}:{image:string;alt:string;transparent?:boolean}){
 const [url,setUrl]=useState('');
 useEffect(()=>{let current=true;setUrl('');if(transparent){setUrl(image);return()=>{current=false}}void prepareCropImage(image).then(v=>{if(current)setUrl(v)}).catch(()=>{});return()=>{current=false}},[image,transparent]);
 return url?<img className="harbor-crop-icon" src={url} data-crop-source={image} alt={alt} draggable={false}/>:null;
}
