'use client'

// components/LabAttachmentUpload.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recordAttachment, completeViaAttachment } from '@/lib/actions/lab'
import { useLang } from '@/lib/i18n/LangContext'

interface Attachment {
  id: string
  file_path: string
  caption: string | null
}

export default function LabAttachmentUpload({
  itemId, clinicId, existingAttachments, itemStatus,
}: {
  itemId: string
  clinicId: string
  existingAttachments: Attachment[]
  itemStatus?: string
}) {
  const lang = useLang()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAttachment, setHasAttachment] = useState(existingAttachments.length > 0)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const supabase = createClient()
    // Path MUST start with clinic_id — this is what the storage RLS
    // policies from the schema check against. A different structure
    // here would silently defeat clinic isolation on this bucket.
    const filePath = `${clinicId}/${itemId}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('lab-attachments')
      .upload(filePath, file)

    if (uploadError) {
      setError(lang==='fr'?`Échec du téléversement : ${uploadError.message}`:`Upload failed: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const result = await recordAttachment(itemId, clinicId, filePath, file.type)
    if (result && 'error' in result && result.error) {
      setError(result.error)
    } else {
      setHasAttachment(true)
    }
    setUploading(false)
  }

  async function handleComplete() {
    setCompleting(true)
    setError(null)
    const result = await completeViaAttachment(itemId)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setCompleting(false)
    } else {
      router.refresh()
    }
  }

  const alreadyCompleted = itemStatus === 'completed'

  return (
    <div style={{
      border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
      padding: '1rem', marginTop: '1rem', marginBottom: '1rem',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 8px' }}>
        {lang==='fr'?'Photo du résultat imprimé (alternative à la saisie manuelle)':'Photo of printed result (alternative to manual entry)'}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {lang==='fr'
          ? "Pour un panel complet (NFS, bandelette urinaire…), une photo du résultat de l'analyseur peut remplacer la saisie ligne par ligne."
          : 'For a complete panel (CBC, urinalysis strip…), a photo of the analyzer result can replace entering each value by hand.'}
      </p>

      {existingAttachments.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          {existingAttachments.map((a) => (
            <div key={a.id} style={{ fontSize: '12px', color: 'var(--color-success-text)', padding: '4px 0' }}>
              ✓ {lang==='fr'?'Fichier joint :':'File attached:'} {a.file_path.split('/').pop()}
            </div>
          ))}
        </div>
      )}

      <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} disabled={uploading} />
      {uploading && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>{lang==='fr'?'Téléversement…':'Uploading…'}</p>}
      {error && <p style={{ fontSize: '12px', color: 'var(--color-critical-text)', marginTop: '6px' }}>{error}</p>}

      {/* Once a photo/PDF is attached, let the tech finish the test right
          here — no need to open the line-by-line values form just to
          click its submit button on an otherwise-empty form. */}
      {hasAttachment && !alreadyCompleted && (
        <button
          type="button"
          onClick={handleComplete}
          disabled={completing}
          style={{
            marginTop: '12px', fontSize: '13px', fontWeight: 500, padding: '8px 16px',
            borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-accent-text-on)',
            cursor: completing ? 'not-allowed' : 'pointer', opacity: completing ? 0.6 : 1,
          }}
        >
          {completing
            ? (lang==='fr'?'…':'…')
            : (lang==='fr'?'✓ Terminer avec cette pièce jointe':'✓ Complete with this attachment')}
        </button>
      )}
      {alreadyCompleted && (
        <p style={{ fontSize: '12px', color: 'var(--color-success-text)', marginTop: '10px' }}>
          ✓ {lang==='fr'?'Examen terminé.':'Test completed.'}
        </p>
      )}
    </div>
  )
}
