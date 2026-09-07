'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export default function Navbar() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <header className="site-header">
    <Link href="/" className="wordmark" aria-label="Curwen Arkiv, buscar">CURWEN <span>ARKIV</span></Link>
    <nav aria-label="Principal"><Link href="/episodes" aria-current={pathname.startsWith('/episode') ? 'page' : undefined}>Archivo</Link><Link href="/graph" aria-current={pathname === '/graph' ? 'page' : undefined}>Red</Link></nav>
  </header>;
}
