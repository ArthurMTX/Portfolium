import { useEffect, useState } from 'react'
import api from '@/api'
import type {
  AdminEmailConfig,
  AdminEmailStats,
  AdminEmailTestResult,
  AdminEmailTestType,
} from '@/features/admin/types'

const defaultEmailConfig: AdminEmailConfig = {
  enable_email: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  smtp_tls: true,
  from_email: '',
  from_name: '',
  frontend_url: '',
}

const defaultEmailStats: AdminEmailStats = {
  total_active_users: 0,
  verified_users: 0,
  email_enabled: false,
  notifications: {
    daily_reports_enabled: 0,
    daily_changes_enabled: 0,
    transaction_notifications_enabled: 0,
  },
  smtp_configured: false,
}

export function useAdminEmail() {
  const [emailConfig, setEmailConfig] = useState<AdminEmailConfig>(defaultEmailConfig)
  const [emailStats, setEmailStats] = useState<AdminEmailStats>(defaultEmailStats)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<AdminEmailTestResult>(null)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [testEmailType, setTestEmailType] = useState<AdminEmailTestType>('simple')
  const [emailTesting, setEmailTesting] = useState(false)

  const loadEmailConfig = async () => {
    setEmailLoading(true)
    try {
      const config = await api.getEmailConfig()
      setEmailConfig(config)
      const stats = await api.getEmailStats()
      setEmailStats(stats)
    } catch (err) {
      console.error('Failed to load email config:', err)
    } finally {
      setEmailLoading(false)
    }
  }

  useEffect(() => {
    void loadEmailConfig()
  }, [])

  const saveEmailConfig = async () => {
    setEmailSaving(true)
    setEmailTestResult(null)
    try {
      const updated = await api.updateEmailConfig(emailConfig)
      setEmailConfig(updated)
      setEmailTestResult({ type: 'success', message: 'Email configuration updated successfully!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update email configuration'
      setEmailTestResult({ type: 'error', message })
    } finally {
      setEmailSaving(false)
    }
  }

  const testEmail = async () => {
    if (!testEmailAddress) {
      setEmailTestResult({ type: 'error', message: 'Please enter an email address' })
      return
    }
    setEmailTesting(true)
    setEmailTestResult(null)
    try {
      const result = await api.testEmail(testEmailAddress, testEmailType)
      setEmailTestResult({ type: 'success', message: result.message })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send test email'
      setEmailTestResult({ type: 'error', message })
    } finally {
      setEmailTesting(false)
    }
  }

  return {
    emailConfig,
    emailStats,
    emailLoading,
    emailSaving,
    emailTestResult,
    testEmailAddress,
    testEmailType,
    emailTesting,
    setEmailConfig,
    setTestEmailAddress,
    setTestEmailType,
    saveEmailConfig,
    testEmail,
  }
}
