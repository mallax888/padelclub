const fs = require('fs');

// Clean up the API route: log real error server-side, return generic message to client
const routePath = 'app/api/record-match/route.ts';
let route = fs.readFileSync(routePath, 'utf8');
const target1 = `  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }`;
const replacement1 = `  if (insertError) {
    console.error('Record match insert error:', insertError)
    return NextResponse.json({ error: 'Could not record match. Please try again.' }, { status: 500 })
  }`;
console.log('Route target found:', route.includes(target1));
route = route.replace(target1, replacement1);
fs.writeFileSync(routePath, route, 'utf8');

// Clean up the client: always show the generic message (data.error is now already generic, but keep it simple)
const formPath = 'components/matches/RecordMatchForm.tsx';
let form = fs.readFileSync(formPath, 'utf8');
const target2 = `    if (!res.ok) {
      toast.error(data.error || 'Could not record match')
      setSubmitting(false)
      return
    }`;
const replacement2 = `    if (!res.ok) {
      toast.error('Could not record match. Please try again.')
      setSubmitting(false)
      return
    }`;
console.log('Form target found:', form.includes(target2));
form = form.replace(target2, replacement2);
fs.writeFileSync(formPath, form, 'utf8');

console.log('Route now logs server-side:', route.includes("console.error('Record match insert error:'"));
console.log('Client shows clean generic message:', form.includes("toast.error('Could not record match. Please try again.')"));
