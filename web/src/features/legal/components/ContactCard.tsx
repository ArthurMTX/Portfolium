import type { ReactNode } from 'react'
import { Mail, Github } from 'lucide-react'
import { OPERATOR_CONTACT, OPERATOR_URL } from '@/features/legal/constants'

interface ContactCardProps {
  contactLabel: ReactNode
  sourceLabel: ReactNode
}

export default function ContactCard({ contactLabel, sourceLabel }: ContactCardProps) {
  const isEmail = OPERATOR_CONTACT.includes('@') && !OPERATOR_CONTACT.startsWith('[')

  return (
    <div className="legal-contact-card">
      <div className="legal-contact-card__row">
        <Mail aria-hidden="true" size={16} />
        <span className="legal-contact-card__label">{contactLabel}</span>
        {isEmail ? (
          <a href={`mailto:${OPERATOR_CONTACT}`}>{OPERATOR_CONTACT}</a>
        ) : (
          <em>{OPERATOR_CONTACT}</em>
        )}
      </div>
      <div className="legal-contact-card__row">
        <Github aria-hidden="true" size={16} />
        <span className="legal-contact-card__label">{sourceLabel}</span>
        <a href={OPERATOR_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </div>
    </div>
  )
}
