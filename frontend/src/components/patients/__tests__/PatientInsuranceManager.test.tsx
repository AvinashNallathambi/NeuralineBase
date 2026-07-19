import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatientInsuranceManager } from '../PatientInsuranceManager'

/**
 * Component test for PatientInsuranceManager.
 *
 * This test verifies the UI behavior without making real API calls.
 * The billingService is mocked at the module level.
 *
 * Pattern: mock the service, render the component, interact with the DOM,
 * assert on what the user sees.
 *
 * Note: Use `findByText` (async, waits for element) instead of `getByText`
 * (sync, fails immediately) when the component has async loading states.
 */

// Mock the billingService module
// Path is relative to this test file: __tests__/ -> patients/ -> components/ -> src/ -> services/
vi.mock('../../../services/billingService', () => ({
  billingService: {
    findPatientInsurances: vi.fn().mockResolvedValue([]),
    findAllPayers: vi.fn().mockResolvedValue([
      { id: 'payer-1', name: 'Blue Cross Blue Shield', payerType: 'commercial' },
      { id: 'payer-2', name: 'Aetna', payerType: 'commercial' },
    ]),
    createPatientInsurance: vi.fn().mockResolvedValue({ id: 'ins-1' }),
    updatePatientInsurance: vi.fn().mockResolvedValue({ id: 'ins-1' }),
    deletePatientInsurance: vi.fn().mockResolvedValue(undefined),
    updateInsurancePriority: vi.fn().mockResolvedValue(undefined),
    scanInsuranceCard: vi.fn().mockResolvedValue({ extractedData: {} }),
  },
}))

// Mock antd message to avoid console noise
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }
})

describe('PatientInsuranceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the insurance coverage card with empty state', async () => {
    render(
      <PatientInsuranceManager
        patientId="387d6bd8-09b3-4b39-8e43-4e96534f4636"
        patientName="John Doe"
        patientDob="1990-01-01"
      />,
    )

    // Card title is always visible (even during loading)
    expect(screen.getByText('Insurance Coverage')).toBeInTheDocument()

    // Wait for loading to finish, then the empty state alert appears
    expect(await screen.findByText('No insurance on file')).toBeInTheDocument()
  })

  it('opens the Add Insurance drawer when Add Insurance button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <PatientInsuranceManager
        patientId="387d6bd8-09b3-4b39-8e43-4e96534f4636"
        patientName="John Doe"
        patientDob="1990-01-01"
      />,
    )

    // Wait for loading to finish
    await screen.findByText('No insurance on file')

    // Click the "Add Insurance" button
    const addButton = screen.getByRole('button', { name: /add insurance/i })
    await user.click(addButton)

    // The drawer should open with form fields
    expect(await screen.findByText('Add Insurance Policy')).toBeInTheDocument()
    expect(screen.getByText('Insurance Payer')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
  })

  it('shows scan insurance card section in add mode', async () => {
    const user = userEvent.setup()

    render(
      <PatientInsuranceManager
        patientId="387d6bd8-09b3-4b39-8e43-4e96534f4636"
        patientName="John Doe"
        patientDob="1990-01-01"
      />,
    )

    // Wait for loading to finish
    await screen.findByText('No insurance on file')

    await user.click(screen.getByRole('button', { name: /add insurance/i }))

    // Scan section should be visible in add mode (not edit mode)
    await waitFor(() => {
      expect(screen.getByText(/scan insurance card/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Scan Front of Card')).toBeInTheDocument()
    expect(screen.getByText('Scan Back of Card')).toBeInTheDocument()
  })
})
