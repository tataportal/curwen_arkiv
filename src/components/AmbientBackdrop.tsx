'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
const STORAGE_KEY='curwen-ambient-enabled';
export default function AmbientBackdrop({controls=true}:{controls?:boolean}) {
  const [enabled,setEnabled]=useState(true),[mounted,setMounted]=useState(false);
  useEffect(()=>{setMounted(true);if(!controls){setEnabled(true);return;}try{setEnabled(localStorage.getItem(STORAGE_KEY)!=='false');}catch{}},[controls]);
  function toggle(){setEnabled(value=>{const next=!value;try{localStorage.setItem(STORAGE_KEY,String(next));}catch{}return next;});}
  return <><div className={'ambient-backdrop'+(enabled?'':' is-disabled')} aria-hidden="true"/>
    {controls&&mounted&&createPortal(<button className="text-action ambient-toggle" aria-pressed={enabled} aria-label={enabled?'Desactivar ambiente':'Activar ambiente'} onClick={toggle}>Ambiente {enabled?'◦':'−'}</button>,document.body)}</>;
}
