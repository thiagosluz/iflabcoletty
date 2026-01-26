const lucide = require('lucide-react');
if (lucide.Clock) {
    console.log('Clock is exported');
} else {
    console.log('Clock is NOT exported');
    console.log('Available exports:', Object.keys(lucide).slice(0, 10));
}
