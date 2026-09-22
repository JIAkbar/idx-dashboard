import { Link } from 'react-router-dom'

/** Kaki baku halaman PAPAN Baru: sumber + tautan metodologi. */
export function KakiBaru({ sumber }: { sumber: string }) {
  return (
    <footer className="bb-kaki">
      <span>{sumber}</span>
      <Link to="/baru/metodologi">bagaimana dihitung →</Link>
    </footer>
  )
}
