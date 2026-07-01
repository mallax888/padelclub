const fs = require('fs');

// Fix 1: Add profile creation to signup page
let signup = fs.readFileSync('app/auth/signup/page.tsx', 'utf8');
signup = signup.replace(
  `    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Account created! Check your email to confirm.')
      router.push('/auth/login')
    }`,
  `    if (error) {
      toast.error(error.message)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles' as any).insert({
          id: user.id,
          full_name: fullName,
          nickname: fullName,
          email: email,
          membership_tier: 'casual',
          credits: 0,
          role: 'member',
          wins: 0,
          losses: 0,
          ranking_points: 0,
        })
      }
      toast.success('Account created! Welcome to PadelClub.')
      router.push('/book')
    }`
);
fs.writeFileSync('app/auth/signup/page.tsx', signup, 'utf8');
console.log('Signup fixed:', signup.includes('getUser'));

// Fix 2: Record match - show admin users
let recordMatch = fs.readFileSync('app/(app)/record-match/page.tsx', 'utf8');
recordMatch = recordMatch.replace(
  `.not('role', 'in', '("staff","admin")')`,
  `.not('role', 'eq', 'staff')`
);
fs.writeFileSync('app/(app)/record-match/page.tsx', recordMatch, 'utf8');
console.log('Record match fixed:', recordMatch.includes("eq', 'staff'"));
