// app/(authenticated)/docs/page.tsx
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { getSectionsForRole, getArticlesForRole } from '@/lib/docs/content'
import DocsViewer from '@/components/docs/DocsViewer'

export default async function DocsPage() {
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const articles = getArticlesForRole(staff.role)
  const sections = getSectionsForRole(staff.role, lang)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px' }}>
          {lang === 'fr' ? 'Centre de documentation' : 'Documentation Center'}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {lang === 'fr'
            ? `${articles.length} ${lang==='fr'?'guides disponibles pour votre rôle':'guides available for your role'} · ${staff.clinicName}`
            : `${articles.length} guides available for your role · ${staff.clinicName}`}
        </p>
      </div>

      <DocsViewer articles={articles} sections={sections} />
    </div>
  )
}
