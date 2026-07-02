const fs = require('fs');
let c = fs.readFileSync('components/membership/MembershipPanel.tsx', 'utf8');

// Add modal state
c = c.replace(
  `const [selectedPack, setSelectedPack] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [purchasing, setPurchasing] = useState(false)`,
  `const [selectedPack, setSelectedPack] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [showBookingPrompt, setShowBookingPrompt] = useState<string | null>(null)`
);

// Trigger modal on successful upgrade
c = c.replace(
  `    if (error) {
      toast.error('Could not update membership.')
    } else {
      toast.success(\`Upgraded to \${MEMBERSHIP_CONFIG[tier].name}!\`)
      router.refresh()
    }
    setUpgrading(false)
  }`,
  `    if (error) {
      toast.error('Could not update membership.')
    } else {
      toast.success(\`Upgraded to \${MEMBERSHIP_CONFIG[tier].name}!\`)
      setShowBookingPrompt(MEMBERSHIP_CONFIG[tier].name)
      router.refresh()
    }
    setUpgrading(false)
  }`
);

fs.writeFileSync('components/membership/MembershipPanel.tsx', c, 'utf8');
console.log('Modal state added:', c.includes('showBookingPrompt'));
console.log('Trigger added:', c.includes('setShowBookingPrompt(MEMBERSHIP_CONFIG[tier].name)'));
