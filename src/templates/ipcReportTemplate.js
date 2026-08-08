export default function getIpcReportHtml(data) {
  let result = `<!DOCTYPE html>
<html lang="und">

<head>
    <meta charset="utf-8">
    <title>IPC_Report_Format.pdf</title>
    <style>
        body {
            font-family: Arial, sans-serif;
        }

        .header-container {
            position: relative;
            text-align: center;
            margin-bottom: 20px;
            padding-top: 20px;
        }

        .header-version {
            position: absolute;
            top: 0;
            right: 20px;
            font-weight: bold;
            font-size: 14px;
        }

        .header-logo {
            position: absolute;
            top: 10px;
            left: 20px;
            width: 90px;
        }

        .header-content {
            margin: 0 130px;
        }

        .header-title {
            font-family: Georgia, serif;
            /* Using a serif font for the title as it appears in the original form */
            font-size: 22px;
            font-weight: bold;
            margin: 25px 0 10px 0;
            letter-spacing: 0.5px;
        }

        .header-subtitle {
            font-size: 13.5px;
            margin-bottom: 6px;
        }
    </style>
</head>

<body>
    <div class="header-container">
        <div class="header-version">Version 1.4</div>
        <img class="header-logo" src="IPC_Report_Format_images/imageFile1.png" alt="IPC Logo">
        <div class="header-content">
            <div class="header-title">SUSPECTED ADVERSE DRUG REACTION REPORTING FORM</div>
            <div class="header-subtitle">For <strong>VOLUNTARY</strong> reporting of ADRs by Healthcare Professionals
            </div>
            <div class="header-subtitle"><strong>INDIAN PHARMACOPOEIA COMMISSION</strong> (National Coordination
                Centre-Pharmacovigilance Programme of India)</div>
            <div class="header-subtitle">Ministry of Health &amp; Family Welfare, Government of India, Sector-23, Raj
                Nagar, Ghaziabad-201002</div>
            <div class="header-subtitle"><strong>PvPI Helpline (Toll Free) :1800-180-3024</strong> (9:00 AM to 5:30 PM,
                Monday-Friday)</div>
        </div>
    </div>

    <table border="1" style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px;">
        <tr>
            <td style="width: 50%; vertical-align: top; padding: 0;">
                <!-- Left Column -->
                <table border="1" style="width: 100%; border-collapse: collapse; height: 100%; border-style: hidden;">
                    <tr>
                        <td style="width: 50%; text-align: center; padding: 6px;">Initial Case  <span
                                style="display:inline-block; width:40px; height:18px; border:1px solid black; vertical-align:middle;"></span>
                        </td>
                        <td style="width: 50%; text-align: center; padding: 6px;">Follow-up Case  <span
                                style="display:inline-block; width:40px; height:18px; border:1px solid black; vertical-align:middle;"></span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding: 6px; font-weight: bold;">A. PATIENT INFORMATION *</td>
                    </tr>
                    <tr>
                        <td style="width: 50%; padding: 6px;">1. Patient Initials:</td>
                        <td style="width: 50%; padding: 6px;">2. Age or date of birth:</td>
                    </tr>
                    <tr>
                        <td style="width: 50%; padding: 6px;">3. Gender: M  F  Other </td>
                        <td style="width: 50%; padding: 6px;">4.Weight (in Kg.)</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding: 6px; font-weight: bold;">B. SUSPECTED ADVERSE REACTION *</td>
                    </tr>
                    <tr>
                        <td style="width: 65%; padding: 6px;">5. Event / Reaction start date (dd/mm/yyyy)</td>
                        <td style="width: 35%; padding: 6px;"></td>
                    </tr>
                    <tr>
                        <td style="width: 65%; padding: 6px;">6. Event / Reaction stop date (dd/mm/yyyy)</td>
                        <td style="width: 35%; padding: 6px;"></td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding: 6px; vertical-align: top; height: 180px;">7. Describe
                            Event/Reaction management with details , if any</td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; vertical-align: top; padding: 0;">
                <!-- Right Column -->
                <table border="1" style="width: 100%; border-collapse: collapse; height: 100%; border-style: hidden;">
                    <tr>
                        <td style="padding: 6px; text-align: center; font-weight: bold;">FOR AMC / NCC USE ONLY</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; font-weight: bold;">Reg. No. / IPD No. / OPD No. / CR No. :</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; font-weight: bold;">AMC Report No.
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; font-weight: bold;">Worldwide Unique No. :</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; vertical-align: top; height: 90px;">12. Relevant investigations with
                            dates :</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; vertical-align: top; height: 100px;">13. Relevant medical / medication
                            history (e.g. allergies,<br>pregnancy, addiction, hepatic, renal dysfunction etc.)</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; vertical-align: top;">
                            <b>14. Seriousness of the reaction :</b> No  if Yes  (please tick anyone)<br>
                            <table style="width: 100%; border: none; margin-top: 5px;">
                                <tr>
                                    <td style="width: 50%; border: none; padding: 3px;"> Death (dd/mm/yyyy)</td>
                                    <td style="width: 50%; border: none; padding: 3px;"> Congenital-anomaly</td>
                                </tr>
                                <tr>
                                    <td style="border: none; padding: 3px;"> Life threatening</td>
                                    <td style="border: none; padding: 3px;"> Disability</td>
                                </tr>
                                <tr>
                                    <td style="border: none; padding: 3px;"> Hospitalization-Initial/Prolonged</td>
                                    <td style="border: none; padding: 3px;"> Other Medically important</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; vertical-align: top;">
                            <b>15. Outcome:</b><br>
                            <table style="width: 100%; border: none; margin-top: 5px;">
                                <tr>
                                    <td style="width: 33%; border: none; padding: 3px;"> Recovered</td>
                                    <td style="width: 33%; border: none; padding: 3px;"> Recovering</td>
                                    <td style="width: 33%; border: none; padding: 3px;"> Not Recovered</td>
                                </tr>
                                <tr>
                                    <td style="border: none; padding: 3px;"> Fatal</td>
                                    <td style="border: none; padding: 3px;"> Recovered with sequelae</td>
                                    <td style="border: none; padding: 3px;"> Unknown</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    <table border="1"
        style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; margin-bottom: 4px;">
        <tr>
            <td colspan="12" style="padding: 6px; font-weight: bold;">C. SUSPECTED MEDICATION(S) *</td>
        </tr>
        <tr style="text-align: center; font-weight: bold; vertical-align: top;">
            <td rowspan="2" style="width: 3%; padding: 4px;">S.<br>No.</td>
            <td rowspan="2" style="width: 15%; padding: 4px;">8.<br>Name<br>(Brand / Generic)</td>
            <td rowspan="2" style="width: 10%; padding: 4px;">Manufacturer<br>(if known)</td>
            <td rowspan="2" style="width: 8%; padding: 4px;">Batch No.<br>/<br>Lot No.</td>
            <td rowspan="2" style="width: 8%; padding: 4px;">Expiry Date<br>(if known)</td>
            <td rowspan="2" style="width: 6%; padding: 4px;">Dose</td>
            <td rowspan="2" style="width: 6%; padding: 4px;">Route</td>
            <td rowspan="2" style="width: 8%; padding: 4px;">Frequency</td>
            <td colspan="2" style="width: 14%; padding: 4px;">Therapy Dates</td>
            <td rowspan="2" style="width: 10%; padding: 4px;">Indication</td>
            <td rowspan="2" style="width: 12%; padding: 4px;">Causality<br>Assessment</td>
        </tr>
        <tr style="text-align: center; font-weight: bold; vertical-align: top;">
            <td style="padding: 4px;">Date<br>Started</td>
            <td style="padding: 4px;">Date<br>Stopped</td>
        </tr>
        <tr style="height: 25px;">
            <td style="text-align: center;">i</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
        <tr style="height: 25px;">
            <td style="text-align: center;">ii</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
        <tr style="height: 25px;">
            <td style="text-align: center;">iii</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
        <tr style="height: 25px;">
            <td style="text-align: center;">iv<sup>#</sup></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
    </table>

    <table border="1"
        style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; text-align: center; margin-bottom: 4px;">
        <tr>
            <td colspan="7" style="text-align: left; padding: 4px; border-right: none;"><b>9.</b> Action taken after
                reaction (<i>please tick</i>)</td>
            <td colspan="4"
                style="text-align: left; padding: 4px; border: 2px solid black; border-bottom: 1px solid black;">
                <b>10.</b> Reaction reappeared after reintroduction of<br>suspected medication (<i>please tick</i>)</td>
        </tr>
        <tr style="font-weight: bold; vertical-align: top;">
            <td style="padding: 4px; width: 4%;">S. No.<br>as per C</td>
            <td style="padding: 4px; width: 10%;">Drug<br>withdrawn</td>
            <td style="padding: 4px; width: 10%;">Dose<br>increased</td>
            <td style="padding: 4px; width: 10%;">Dose<br>reduced</td>
            <td style="padding: 4px; width: 10%;">Dose not<br>changed</td>
            <td style="padding: 4px; width: 10%;">Not<br>applicable</td>
            <td style="padding: 4px; width: 8%;">Unknown</td>

            <td style="padding: 4px; width: 9%; border-left: 2px solid black; border-top: 1px solid black;">Yes</td>
            <td style="padding: 4px; width: 9%; border-top: 1px solid black;">No</td>
            <td style="padding: 4px; width: 10%; border-top: 1px solid black;">Effect<br>unknown</td>
            <td style="padding: 4px; width: 10%; border-right: 2px solid black; border-top: 1px solid black;">
                Dose<br>(if re-introduced)</td>
        </tr>
        <tr style="height: 25px;">
            <td>i</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td style="border-left: 2px solid black;"></td>
            <td></td>
            <td></td>
            <td style="border-right: 2px solid black;"></td>
        </tr>
        <tr style="height: 25px;">
            <td>ii</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td style="border-left: 2px solid black;"></td>
            <td></td>
            <td></td>
            <td style="border-right: 2px solid black;"></td>
        </tr>
        <tr style="height: 25px;">
            <td>iii</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td style="border-left: 2px solid black;"></td>
            <td></td>
            <td></td>
            <td style="border-right: 2px solid black;"></td>
        </tr>
        <tr style="height: 25px;">
            <td>iv</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td style="border-left: 2px solid black; border-bottom: 2px solid black;"></td>
            <td style="border-bottom: 2px solid black;"></td>
            <td style="border-bottom: 2px solid black;"></td>
            <td style="border-right: 2px solid black; border-bottom: 2px solid black;"></td>
        </tr>
    </table>

    <table border="1"
        style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; text-align: center; margin-bottom: 4px;">
        <tr>
            <td colspan="8" style="text-align: left; padding: 4px;"><b>11.</b> Concomitant medical product including
                self-medication and herbal remedies with therapy dates (Exclude those used to treat reaction)</td>
        </tr>
        <tr style="text-align: center; font-weight: bold; vertical-align: top;">
            <td rowspan="2" style="width: 4%; padding: 4px;">S. No.</td>
            <td rowspan="2" style="width: 22%; padding: 4px;">Name<br>(Brand / Generic)</td>
            <td rowspan="2" style="width: 10%; padding: 4px;">Dose</td>
            <td rowspan="2" style="width: 10%; padding: 4px;">Route</td>
            <td rowspan="2" style="width: 14%; padding: 4px;">Frequency (OD,<br>BD, etc.)</td>
            <td colspan="2" style="width: 20%; padding: 4px;">Therapy Dates</td>
            <td rowspan="2" style="width: 20%; padding: 4px;">Indication</td>
        </tr>
        <tr style="text-align: center; font-weight: bold; vertical-align: top;">
            <td style="padding: 4px;">Date Started</td>
            <td style="padding: 4px;">Date Stopped</td>
        </tr>
        <tr style="height: 25px;">
            <td>i</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
        <tr style="height: 25px;">
            <td>ii</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
        <tr style="height: 25px;">
            <td>iii<sup>#</sup></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
    </table>

    <table border="1" style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px;">
        <tr>
            <td style="width: 60%; vertical-align: top; padding: 6px; height: 160px; background-color: #f4f8ff;">
                <b>Additional Information :</b>
            </td>
            <td style="width: 40%; vertical-align: top; padding: 0;">
                <table border="1" style="width: 100%; border-collapse: collapse; height: 100%; border-style: hidden;">
                    <tr>
                        <td style="padding: 6px; font-weight: bold; background-color: #cc0000; color: white;">D.
                            REPORTER DETAILS *</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; line-height: 1.6; background-color: #f4f8ff;">
                            <b>16.</b> Name &amp; Address : ____________________________________________<br>
                            ________________________________________________________________<br>
                            Pin : __________ Email : ___________________________________________<br>
                            Contact No- : _______________________________<br>
                            Occupation : _______________________Signature : ___________________
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; font-weight: bold; background-color: #f4f8ff;">17. Date of this report
                            (dd/mm/yyyy) :</td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td colspan="2" style="padding: 6px; font-weight: bold; background-color: #f0f0f0;">
                Signature and Name of Receiving Personnel : <input type="text" style="width: 250px;">
            </td>
        </tr>
        <tr>
            <td colspan="2"
                style="padding: 6px; font-size: 13px; text-align: justify; background-color: #cc0000; color: white;">
                <b>Confidentiality :</b> The patient’s identity is held in strict confidence and protected to the
                fullest extent. Submission of a report does not constitute an admission that medical personnel or
                manufacturer or the product caused or contributed to the reaction. Submission of an ADR report does not
                have any legal implication on the reporter.
            </td>
        </tr>
    </table>

    <figcaption># Use separate page for more information</figcaption>

    <p>* Mandatory Fields for suspected ADR Reporting Form</p>

    <table border="1">
        <tr>
            <td>
                <h2>ADVICE ABOUT REPORTING</h2>
                <ul>
                    <li>
                        <p>A. What to report?
                            All adverse events should be reported
                            Report non-serious, known or unknown, frequent or rare adverse drug reactions due to
                            Medicines, Vaccines &amp; Herbal Products.
                            Report every serious adverse drug reactions. A reaction is serious when the patient outcome
                            is :</p>
                        <ul>
                            <li>
                                <p> Death</p>
                            </li>
                            <li>
                                <p> Life-threatening</p>
                            </li>
                            <li>
                                <p> Hospitalization (initial or prolonged)</p>
                            </li>
                            <li>
                                <p> Disability (significant, persistent or permanent)</p>
                            </li>
                            <li>
                                <p> Congenital anomaly</p>
                            </li>
                            <li>
                                <p> Report intervention to prevent permanent impairment or damage</p>
                            </li>
                        </ul>
                        <p>NOTE : Serious/Adverse Event following immunization can also be reported in Serious AEFI case
                            Notification<br>Form available on <span
                                style="text-decoration: underline;">http://www.ipc.gov.in</span></p>
                    </li>
                    <li>
                        <p>B. Who can report?</p>
                        <p>All healthcare professionals (Clinicians, Dentists, Pharmacists and Nurse etc.) can report
                            adverse drug reactions</p>
                    </li>
                    <li>
                        <p>C. Where to report?
                            Duly filled in Suspected Adverse Drug Reaction Reporting Form can be sent to the nearest
                            Adverse Drug Reaction Monitoring
                            Centre (AMC) or directly to the National Coordination Centre (NCC) for PvPI.
                            Call on Helpline (Toll Free) 1800 180 3024 to report ADRs or directly mail this filled form
                            to <span style="text-decoration: underline;">pvpi.ipc@gov.in</span>
                            A list of nationwide AMCs is available at : http://www.ipc.gov.in,
                            http://www.ipc.gov.in/PvPI/pv_home.html</p>
                    </li>
                    <li>
                        <p>D.What happens to the submitted information?</p>
                        <ul>
                            <li>
                                <p> Information provided in this form is handled in strict confidence. The causality
                                    assessment is carried out at AMCs by using
                                    WHO-UMC scale. The analyzed forms are forwarded to the NCC-PvPI through ADR
                                    database. Finally the data is analyzed
                                    <span style="text-decoration: underline;">and</span> <span
                                        style="text-decoration: underline;">forwarded</span> <span
                                        style="text-decoration: underline;">to</span> <span
                                        style="text-decoration: underline;">the</span> <span
                                        style="text-decoration: underline;">Global</span> <span
                                        style="text-decoration: underline;">Pharmacovigilance</span> <span
                                        style="text-decoration: underline;">Database</span> <span
                                        style="text-decoration: underline;">managed</span> <span
                                        style="text-decoration: underline;">by</span> <span
                                        style="text-decoration: underline;">WHO</span> <span
                                        style="text-decoration: underline;">Uppsala</span> <span
                                        style="text-decoration: underline;">Monitoring</span> <span
                                        style="text-decoration: underline;">Centre</span> <span
                                        style="text-decoration: underline;">in</span> <span
                                        style="text-decoration: underline;">Sweden.</span>
                                </p>
                            </li>
                            <li>
                                <p> The reports are periodically reviewed by the NCC-PvPI. The information generated on
                                    the basis of these reports helps in
                                    continuous assessment of the benefit-risk ratio of medicines.</p>
                            </li>
                            <li>
                                <p> The Signal Review Panel of PvPI reviews the data and suggests any interventions
                                    that may be required.</p>
                            </li>
                        </ul>
                    </li>
                    <li>
                        <p>E. Mandatory fields for suspected ADR Reporting Form (*)</p>
                    </li>
                </ul>
                <p>Patient initials, age at onset of reaction, reaction term(s), date of onset of reaction, suspected
                    medication(s) &amp; reporter<br>information.</p>
            </td>
        </tr>
        <tr>
            <td>
                <table border="1">
                    <tr>
                        <td>
                            <p>For Adverse Drug Reaction Reporting Tools</p>
                            <p> E-mail : <span style="text-decoration: underline;">pvpi.ipc@gov.in</span></p>
                            <p> PvPI Helpline (Toll Free) : 1800 180 3024 (9:00 AM to 5:30 PM, Monday-Friday)</p>
                            <p> ADR Mobile App : “ADRPvPI”</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>


</body>

</html>`;

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
    '<tr style="height: 25px;">\n            <td style="text-align: center;">i</td>\n            <td></td>',
    '<tr style="height: 25px;">\n            <td style="text-align: center;">i</td>\n            <td><strong>' + safe(data.prescriptionNotes) + '</strong></td>'
  );

  return result;
}