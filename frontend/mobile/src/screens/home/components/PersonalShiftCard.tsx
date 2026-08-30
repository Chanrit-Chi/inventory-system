import React from 'react'
import { StaffPerformanceCard } from '../../../components/StaffPerformanceCard'
import type { UserAccount, StaffPerformance } from '../../../types'

export interface PersonalShiftCardProps {
  currentUser: UserAccount | null
  myPerformance: StaffPerformance | null
  myPerfPeriod: 'today' | '7d' | 'month'
  setMyPerfPeriod: (p: 'today' | '7d' | 'month') => void
  onOpenMyPerfModal: () => void
  onOpenDailySettlement?: () => void
}

export const PersonalShiftCard: React.FC<PersonalShiftCardProps> = ({
  currentUser,
  myPerformance,
  myPerfPeriod,
  setMyPerfPeriod,
  onOpenMyPerfModal,
  onOpenDailySettlement,
}) => {
  if (!currentUser) return null

  const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'Staff'

  const handlePressCard = () => {
    if (myPerfPeriod === 'today' && onOpenDailySettlement) {
      onOpenDailySettlement()
    } else {
      onOpenMyPerfModal()
    }
  }

  return (
    <StaffPerformanceCard
      performance={myPerformance}
      period={myPerfPeriod}
      onSelectPeriod={setMyPerfPeriod}
      onPressDetails={handlePressCard}
      greetingName={currentUser.name || 'Staff'}
      title={`Hello, ${firstName} 👋`}
      badgeText={myPerfPeriod === 'today' ? "Sign Off Sales" : "My Earnings"}
      salesLabel="MY SALES"
      commissionLabel="MY COMMISSION"
      iconName="person"
    />
  )
}
