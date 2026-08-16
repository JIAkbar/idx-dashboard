import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface NotifikasiRow {
  id: string
  /** null = pengumuman untuk semua (fitur baru), bukan kabar pribadi. */
  untuk: string | null
  jenis: 'kurasi' | 'fitur'
  judul: string
  pesan: string
  tautan: string | null
  setoran_id: string | null
  dibuat_pada: string
  dibaca_pada: string | null
}

/** Berapa banyak yang diambil sekali muat. Lonceng bukan arsip — yang lama
 *  tetap ada di tabel, tapi tak ada yang menggulung 200 baris di popover. */
const BATAS = 30

export async function daftarNotifikasi(): Promise<NotifikasiRow[]> {
  const { data, error } = await supabase
    .from('notifikasi')
    .select('*')
    .order('dibuat_pada', { ascending: false })
    .limit(BATAS)
  if (error) throw error
  return (data ?? []) as NotifikasiRow[]
}

/**
 * Tandai sudah dibaca. Pengumuman bersama (`untuk` null) SENGAJA dilewati:
 * barisnya dipakai bersama semua kontributor, dan menandainya berarti
 * menandai untuk semua orang sekaligus.
 */
export async function tandaiDibaca(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifikasi')
    .update({ dibaca_pada: new Date().toISOString() })
    .eq('id', id)
    .is('dibaca_pada', null)
  if (error) throw error
}

export async function tandaiSemuaDibaca(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('notifikasi')
    .update({ dibaca_pada: new Date().toISOString() })
    .eq('untuk', user.id)
    .is('dibaca_pada', null)
  if (error) throw error
}

/** Pengumuman fitur baru (#123) — superadmin saja; RLS yang menegakkannya. */
export async function umumkanFitur(judul: string, pesan: string, tautan?: string): Promise<void> {
  const { error } = await supabase
    .from('notifikasi')
    .insert({ untuk: null, jenis: 'fitur', judul, pesan, tautan: tautan ?? null })
  if (error) throw error
}

/**
 * Isi lonceng. Sengaja TIDAK realtime: kabar kurasi tidak mendesak sampai
 * perlu soket terbuka sepanjang sesi, dan satu query saat panel dibuka jauh
 * lebih murah daripada langganan yang menganggur berjam-jam.
 */
export function useNotifikasi() {
  const [daftar, setDaftar] = useState<NotifikasiRow[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const muat = useCallback(() => {
    daftarNotifikasi()
      .then(setDaftar)
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat notifikasi.'))
  }, [])

  useEffect(() => { muat() }, [muat])

  const belumDibaca = (daftar ?? []).filter((n) => n.untuk !== null && n.dibaca_pada === null).length

  return { daftar, belumDibaca, galat, muat }
}
