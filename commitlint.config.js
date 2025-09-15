module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Neue Features
        'fix',      // Bugfixes
        'docs',     // Dokumentation
        'style',    // Code-Formatierung
        'refactor', // Code-Refactoring
        'perf',     // Performance-Verbesserungen
        'test',     // Tests
        'chore',    // Wartungsarbeiten
        'ci',       // CI/CD Änderungen
        'build',    // Build-System
        'revert'    // Reverts
      ]
    ],
    'subject-case': [2, 'never', ['pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never']
  }
};

