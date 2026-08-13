const fs = require('fs');
const file = 'd:/MedScribe/src/screens/styles/TranscriptReviewScreen.styles.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('Dimensions')) {
  content = content.replace(
    "import { Platform, StyleSheet } from 'react-native';",
    "import { Platform, StyleSheet, Dimensions } from 'react-native';\n\nconst { width } = Dimensions.get('window');\nconst scale = size => Math.round((width / 390) * size);"
  );
}

content = content.replace(/fontSize: (\d+)/g, 'fontSize: scale($1)');
content = content.replace(/lineHeight: (\d+)/g, 'lineHeight: scale($1)');

fs.writeFileSync(file, content);
console.log('Done!');
