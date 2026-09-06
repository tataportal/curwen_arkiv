'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
const STORAGE_KEY='curwen-ambient-enabled';
export default function AmbientBackdrop() {
  const [enabled,setEnabled]=useState(true),[mounted,setMounted]=useState(false);
  useEffect(()=>{setMounted(true);try{setEnabled(localStorage.getItem(STORAGE_KEY)!=='false');}catch{}},[]);
  function toggle(){setEnabled(value=>{const next=!value;try{localStorage.setItem(STORAGE_KEY,String(next));}catch{}return next;});}
  return <><div className={'ambient-backdrop'+(enabled?'':' is-disabled')} aria-hidden="true"/>
    {mounted&&createPortal(<button className="text-action ambient-toggle" aria-pressed={enabled} aria-label={enabled?'Desactivar ambiente':'Activar ambiente'} onClick={toggle}>Ambiente {enabled?'◦':'−'}</button>,document.body)}</>;
}
