const fs = require('fs');
const path = 'components/booking/BookingFlow.tsx';
let c = fs.readFileSync(path, 'utf8');

const target1 = `import { useState, useEffect } from 'react'`;
const replacement1 = `import { useState, useEffect, useRef } from 'react'`;

const target2 = `  const goBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }`;
const replacement2 = `  const goBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  // Android/PWA hardware back button support: register each forward step
  // with browser history so the native back gesture steps back one at a
  // time instead of exiting the wizard entirely.
  const stepIndexRef = useRef(0)
  useEffect(() => {
    const idx = STEPS.indexOf(step)
    if (idx > stepIndexRef.current) {
      window.history.pushState({ padelStep: idx }, '')
    }
    stepIndexRef.current = idx
  }, [step])

  useEffect(() => {
    const onPopState = () => {
      setStep(prev => {
        const idx = STEPS.indexOf(prev)
        return idx > 0 ? STEPS[idx - 1] : prev
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])`;

console.log('Target 1 found:', c.includes(target1));
console.log('Target 2 found:', c.includes(target2));

c = c.replace(target1, replacement1);
c = c.replace(target2, replacement2);

fs.writeFileSync(path, c, 'utf8');
console.log('useRef import added:', c.includes('useState, useEffect, useRef'));
console.log('popstate listener added:', c.includes("window.addEventListener('popstate'"));
