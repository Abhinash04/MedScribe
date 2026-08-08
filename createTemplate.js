const fs = require('fs');
const html = fs.readFileSync('d:/MedScribe/docs/ipc_output/IPC_Report_Format.html', 'utf8');

const jsCode = `export default function getIpcReportHtml(data) {
  let result = \`${html.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;

  const safe = (str) => str ? String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
  
  result = result.replace(
    '1. Patient Initials:',
    '1. Patient Initials: <strong>' + safe(data.patientName) + '</strong>'
  );
  
  result = result.replace(
    '2. Age or date of birth:',
    '2. Age or date of birth: <strong>' + safe(data.age) + '</strong>'
  );
  
  let mCheck = data.gender && data.gender.toLowerCase().startsWith('m') ? '☑' : '';
  let fCheck = data.gender && data.gender.toLowerCase().startsWith('f') ? '☑' : '';
  let oCheck = data.gender && !data.gender.toLowerCase().startsWith('m') && !data.gender.toLowerCase().startsWith('f') ? '☑' : '';
  result = result.replace(
    '3. Gender: M  F  Other ',
    '3. Gender: M ' + mCheck + ' F ' + fCheck + ' Other ' + oCheck
  );

  result = result.replace(
    '7. Describe Event/Reaction management with details , if any</td>',
    '7. Describe Event/Reaction management with details , if any<br/><br/><strong>' + safe(data.symptoms) + '<br/><br/>' + safe(data.diagnosis) + '</strong></td>'
  );

  result = result.replace(
    '13. Relevant medical / medication history (e.g. allergies,<br>pregnancy, addiction, hepatic, renal dysfunction etc.)</td>',
    '13. Relevant medical / medication history (e.g. allergies,<br>pregnancy, addiction, hepatic, renal dysfunction etc.)<br/><br/><strong>' + safe(data.medicalHistory) + '</strong></td>'
  );

  // Address
  result = result.replace(
    '16.</b> Name &amp; Address : ____________________________________________<br>',
    '16.</b> Name &amp; Address : <strong>' + safe(data.address) + '</strong><br>'
  );
  result = result.replace(
    'Pin : __________',
    'Pin : <strong>' + safe(data.pinCode) + '</strong>'
  );
  result = result.replace(
    'Contact No- : _______________________________<br>',
    'Contact No- : <strong>' + safe(data.contactNumber) + '</strong><br>'
  );

  // For medications, put it in the first row of section C
  result = result.replace(
    '<tr style="height: 25px;">\\n            <td style="text-align: center;">i</td>\\n            <td></td>',
    '<tr style="height: 25px;">\\n            <td style="text-align: center;">i</td>\\n            <td><strong>' + safe(data.prescriptionNotes) + '</strong></td>'
  );

  return result;
}`;

fs.writeFileSync('d:/MedScribe/src/templates/ipcReportTemplate.js', jsCode);
