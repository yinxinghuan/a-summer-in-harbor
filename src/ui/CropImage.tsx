import {useEffect,useState} from 'react';
import {prepareCropImage} from '../world/crop-art';
export function CropImage({image,alt}:{image:string;alt:string}){
 const [url,setUrl]=useState('');
 useEffect(()=>{let current=true;setUrl('');void prepareCropImage(image).then(v=>{if(current)setUrl(v)}).catch(()=>{});return()=>{current=false}},[image]);
 return url?<img className="harbor-crop-icon" src={url} data-crop-source={image} alt={alt} draggable={false}/>:null;
}
