# Voice-to-Structured Medical Documentation Mobile Application (SRS)

# Table of Contents

1. Introduction
2. Overall Description
3. Functional Requirements
4. Non-Functional Requirements
5. System Workflow
6. External Dependencies
7. Constraints
8. Future Enhancements
9. Assumptions

---

# 1. Introduction

## 1.1 Purpose

The purpose of this project is to develop a React Native mobile application that assists doctors in creating structured patient records through voice dictation.

Instead of manually typing patient details, doctors can verbally dictate all patient information. The application captures the speech using the device microphone, converts the speech into text, extracts important medical fields, and presents the information in a structured documentation format.

The application aims to reduce documentation time while improving efficiency during patient consultations.

---

## 1.2 Scope

The application shall:

- Record doctor speech using the device microphone.
- Convert spoken speech into text.
- Process the generated transcript.
- Identify important patient-related fields.
- Generate a structured patient report.
- Display the report inside the mobile application.

The application is intended only for documentation assistance and does not perform any diagnosis or medical decision-making.

---

## 1.3 Intended Users

Primary users include:

- Doctors
- Physicians
- Medical Practitioners
- Healthcare Professionals

---

## 1.4 Definitions

| Term | Description |
|------|-------------|
| Speech Recognition | Conversion of spoken voice into text |
| Transcript | Raw text generated from doctor speech |
| Structured Report | Organized document containing predefined patient fields |
| Dictation | Voice input provided by the doctor |

---

# 2. Overall Description

## 2.1 Product Perspective

The application is a standalone React Native mobile application.

The workflow consists of four major stages:

1. Voice Recording
2. Speech-to-Text Conversion
3. Information Extraction
4. Structured Report Generation

---

## 2.2 Product Features

The application shall provide the following features:

- Voice recording using the device microphone
- Speech-to-text conversion
- Display of generated transcript
- Extraction of patient information
- Structured report generation
- Report preview

---

## 2.3 User Workflow

```text
Doctor Opens App
        │
        ▼
Clicks Microphone Button
        │
        ▼
Speech Recording Starts
        │
        ▼
Doctor Dictates Patient Details
        │
        ▼
Speech Converted Into Text
        │
        ▼
Text Processing
        │
        ▼
Patient Information Extraction
        │
        ▼
Structured Medical Report
        │
        ▼
Display Final Report
```

---

# 3. Functional Requirements

## FR-1 Application Launch

### Description

The application shall allow users to launch the mobile application.

### Inputs

None

### Outputs

Application home screen.

---

## FR-2 Voice Recording

### Description

The application shall allow doctors to start voice recording using the device microphone.

### Trigger

User taps the microphone icon.

### Inputs

Voice input.

### Outputs

Audio stream.

---

## FR-3 Speech Recognition

### Description

The application shall convert the doctor's speech into text using the speech recognition library.

### Input

Recorded speech.

### Output

Speech transcript.

### External Library

```
@appcitor/react-native-voice-to-text
```

Repository:

```
https://github.com/ChathuraLiyanapathirana/react-native-voice-to-text
```

---

## FR-4 Transcript Display

### Description

The generated transcript shall be displayed to the user.

### Output Example

```
Patient name is Rahul Sharma.
Age 42 years.
Lives in Delhi.
Contact number 9876543210.
Patient complains of fever and cough for three days.
```

---

## FR-5 Information Extraction

### Description

The application shall process the transcript and extract predefined patient information.

The system shall identify fields whenever they are present in the dictated speech.

Example fields include:

- Patient Name
- Age
- Gender
- Address
- PIN Code
- Contact Number
- Symptoms
- Medical History
- Diagnosis
- Prescription Notes
- Additional Remarks

---

## FR-6 Structured Report Generation

### Description

The application shall convert the extracted information into a structured patient report.

Example:

```text
Patient Name:
Rahul Sharma

Age:
42 Years

Gender:
Male

Address:
Sector 12,
Dwarka,
New Delhi
110078

Contact Number:
9876543210

Symptoms:
• Fever
• Cough

Medical History:
Diabetes

Doctor Notes:
Patient advised for blood tests.
```

---

## FR-7 Missing Information Handling

### Description

If a particular field is not found in the transcript, the field shall remain empty.

Example

```text
Patient Name:
Rahul Sharma

Age:
Not Available

Symptoms:
Fever
```

---

## FR-8 Report Preview

### Description

The application shall display the generated structured report for user review.

---

# 4. Non-Functional Requirements

## NFR-1 Performance

Speech recognition should begin immediately after microphone activation.

---

## NFR-2 Accuracy

The speech recognition output should accurately represent the spoken words, subject to the capabilities of the underlying speech recognition engine.

---

## NFR-3 Usability

The application should provide a simple interface suitable for doctors during consultations.

---

## NFR-4 Reliability

The application should gracefully handle interruptions such as microphone permission denial or speech recognition failure.

---

## NFR-5 Compatibility

The application shall support Android devices compatible with React Native.

---

## NFR-6 Maintainability

The application architecture should be modular to support future enhancements.

---

# 5. System Workflow

```text
┌────────────────────────────┐
│ Doctor Opens Application   │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Tap Microphone Icon        │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Record Doctor Speech       │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Convert Speech To Text     │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Process Transcript         │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Extract Patient Fields     │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Generate Structured Report │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Display Final Report       │
└────────────────────────────┘
```

---

# 6. External Dependencies

## Technology Stack

| Component | Technology |
|-----------|------------|
| Mobile Framework | React Native |
| Language | JavaScript / TypeScript |
| Speech Recognition | @appcitor/react-native-voice-to-text |

---

## Third-Party Package

```
npm install @appcitor/react-native-voice-to-text
```

GitHub Repository

```
https://github.com/ChathuraLiyanapathirana/react-native-voice-to-text
```

---

# 7. Constraints

- The application depends on device microphone availability.
- Microphone permission must be granted by the user.
- Speech recognition quality depends on the underlying speech recognition engine and environmental conditions.
- Structured report quality depends on the completeness and clarity of the doctor's dictation.

---

# 8. Future Enhancements

Potential future enhancements include:

- AI-assisted medical entity extraction.
- Automatic ICD-10 code identification.
- PDF report generation.
- Electronic Health Record (EHR) integration.
- Multi-language speech recognition.
- Cloud synchronization.
- Patient history management.
- Voice command support.
- Offline speech recognition.
- Report editing before saving.

---

# 9. Assumptions

- Doctors will dictate patient information in a clear and understandable manner.
- The mobile device supports microphone access.
- The speech recognition library functions correctly on supported platforms.
- The predefined patient fields are sufficient for the initial version of the application.
