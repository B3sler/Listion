module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New features
        "fix", // Bugfixes
        "docs", // Documentation
        "style", // Code formatting
        "refactor", // Code refactoring
        "perf", // Performance improvements
        "test", // Tests
        "chore", // Maintenance tasks
        "ci", // CI/CD changes
        "build", // Build system
        "revert", // Reverts
      ],
    ],
    "subject-case": [2, "never", ["pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
  },
};
