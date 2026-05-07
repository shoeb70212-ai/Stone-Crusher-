const fs = require('fs');
let code = fs.readFileSync('src/lib/print-utils.ts', 'utf8');

code = code.replace(/const customerName = customer\?.name \|\| \(quotation\.customerId === 'CASH' \? 'Cash Customer' \: quotation\.customerId\);/g, "const customerName = customer?.name || (quotation.customerId === 'CASH' ? 'Cash Customer' : quotation.customerId) || 'Unknown Customer';");

code = code.replace(/drawLabelValue\('M\/S', customerName, leftX, contentY, 24, 56, true\);/g, "drawLabelValue('M/S', customerName || '-', leftX, contentY, 24, 56, true);");

code = code.replace(/drawLabelValue\('Name', customerName, leftX, contentY, 22, 58, true\);/g, "drawLabelValue('Name', customerName || '-', leftX, contentY, 22, 58, true);");

fs.writeFileSync('src/lib/print-utils.ts', code);
console.log("Fixed types in print-utils.ts");
